// JSONL adapter of the `store` port (LG-S02, LG-C06, REQ-SR-001…004, design D-3…D-5): one commit per line, each line
// ended by a line feed — the commit end marker; the bytes after the last line feed are the torn tail.
//
// Appends are serialised by lock files `<ledger>.lock.<n>`, the greatest `<n>` being the current lock. A take creates
// the next number whole (a hard link of a written temporary file) and then verifies that the greatest other lock is
// the one it looked at — a compare-and-swap. A take that holds removes the smaller lock files; a release never removes
// a lock file, it replaces its own by an expired lock, so a number never holds two takes. Fencing — the lock still its
// own with more than half of the TTL left — runs right before every write and before the cut of a recovery. Every
// append ends with `fsync`. Recovery of a torn tail (`recover`) is off unless asked (design I-27): then a torn tail is
// handed over, except under the live lock of another writer, where it is an append in progress.

import * as nodeFs from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppendResult, Store, StoredCommit, StoredLedger } from "../../ledger/ports/store.ts";

/** The part of `node:fs` the adapter uses; a test passes a recording or failing one (design D-5). */
export type JsonlFs = Pick<
  typeof nodeFs,
  | "closeSync"
  | "fsyncSync"
  | "ftruncateSync"
  | "linkSync"
  | "mkdirSync"
  | "openSync"
  | "readFileSync"
  | "readdirSync"
  | "renameSync"
  | "unlinkSync"
  | "writeSync"
>;

export type StoreOptions = {
  readonly owner?: string;
  readonly now?: () => number;
  readonly ttl?: number;
  readonly recover?: boolean;
  /** Test seam (design D-2): `take` after the store looked at the lock, `fence` right before a fencing check. */
  readonly pause?: (point: "take" | "fence") => void;
};

/** A lock file as looked at: its number and its text; `lock` is `null` when the text cannot be read as a lock. */
type Looked = { readonly n: number; readonly text: string; readonly lock: { owner: string; expires: number } | null };
type Held = { readonly n: number; readonly text: string; readonly expires: number };

const OWNER = /^[A-Za-z0-9-]{1,64}$/;
const MOVED: AppendResult = { ok: false, reason: "moved" };
const LF = 0x0a;
/** How often a look or a read retries while lock files change under it (a removal racing a listing, I-37, I-42). */
const RETRIES = 50;

function seqOf(text: string): number {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && "seq" in value && typeof value.seq === "number") return value.seq;
  } catch {
    // an unreadable line: the opener refuses it (LG-C04)
  }
  return Number.NaN;
}

const codeOf = (e: unknown): string | undefined => (e as NodeJS.ErrnoException).code;
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UTF8 = new TextDecoder("utf-8", { fatal: true });
/** The ledger bytes split at the last line feed: the complete lines and the torn tail (empty when there is none). */
const split = (bytes: Uint8Array): { readonly complete: Uint8Array; readonly tail: Uint8Array } => {
  const end = bytes.lastIndexOf(LF) + 1;
  return { complete: bytes.subarray(0, end), tail: bytes.subarray(end) };
};
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const lockText = (owner: string, expires: number): string => JSON.stringify({ expires, owner }) + "\n";

function parseLock(text: string): Looked["lock"] {
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const keys = Object.keys(v).sort();
    if (keys.length !== 2 || keys[0] !== "expires" || keys[1] !== "owner") return null;
    const { expires, owner } = v as { expires: unknown; owner: unknown };
    if (typeof owner !== "string" || typeof expires !== "number" || !Number.isSafeInteger(expires)) return null;
    return lockText(owner, expires) === text ? { owner, expires } : null;
  } catch {
    return null;
  }
}

/** The complete lines of `bytes` (which end with a line feed or are empty), decoded as strict UTF-8. */
function commitsOf(bytes: Uint8Array): StoredCommit[] {
  const text = UTF8.decode(bytes);
  if (text === "") return [];
  const lines = text.split("\n");
  lines.pop();
  return lines.map((line) => ({ seq: seqOf(line), text: line }));
}

export function jsonlStore(file: string, options: StoreOptions & { readonly fs?: JsonlFs } = {}): Store {
  const fs = options.fs ?? nodeFs;
  const owner = options.owner ?? randomUUID();
  const ttl = options.ttl ?? 10_000;
  const recover = options.recover ?? false;
  const pause = options.pause ?? (() => {});
  if (!OWNER.test(owner)) throw new RangeError(`store owner ${JSON.stringify(owner)} is not [A-Za-z0-9-]{1,64}`);
  if (!Number.isSafeInteger(ttl) || ttl < 2) throw new RangeError(`store TTL ${ttl} is not a safe integer >= 2`);

  const dir = dirname(file);
  const name = basename(file);
  const LOCK = new RegExp(`^${escapeRegExp(name)}\\.lock\\.([1-9][0-9]*)$`);
  const TORN = new RegExp(`^${escapeRegExp(name)}\\.([1-9][0-9]*)\\.torn$`);
  const lockFile = (n: number): string => join(dir, `${name}.lock.${n}`);
  const tmpFile = join(dir, `${name}.lock.${owner}.tmp`);
  const recoveredDir = join(dir, "recovered");

  const clock = (): number => {
    const t = (options.now ?? Date.now)();
    if (!Number.isSafeInteger(t) || t < 0) throw new RangeError(`store clock reading ${t} is not a safe integer >= 0`);
    return t;
  };
  const quietly = (act: () => void): void => {
    try {
      act();
    } catch {
      // a failed removal or release is never thrown (REQ-SR-002)
    }
  };
  const numbered = (pattern: RegExp, names: readonly string[]): number[] =>
    names.flatMap((n) => {
      const m = pattern.exec(n);
      return m === null ? [] : [Number(m[1])];
    }).sort((a, b) => a - b);
  const lockNumbers = (): number[] => numbered(LOCK, fs.readdirSync(dir));

  const readBytes = (): Uint8Array => {
    try {
      return fs.readFileSync(file);
    } catch (e) {
      if (codeOf(e) === "ENOENT") return new Uint8Array(0);
      throw e;
    }
  };
  /** Reads a lock file; `null` when it disappeared (or, on Windows, is being replaced) — look again (I-16, I-42). */
  const readLock = (n: number): string | null => {
    try {
      return fs.readFileSync(lockFile(n), "utf8");
    } catch (e) {
      const code = codeOf(e);
      if (code === "ENOENT" || (code === "EPERM" && process.platform === "win32")) return null;
      throw e;
    }
  };
  /** The current lock (REQ-SR-002): the greatest lock file, or `null` when there is none. */
  const look = (): Looked | null => {
    for (let i = 0; i < RETRIES; i++) {
      const n = lockNumbers().at(-1);
      if (n === undefined) return null;
      const text = readLock(n);
      if (text !== null) return { n, text, lock: parseLock(text) };
    }
    throw new Error(`the lock files of ${file} keep changing`);
  };
  const sameLock = (a: Looked | null, b: Looked | null): boolean =>
    a === null ? b === null : b !== null && a.n === b.n && a.text === b.text;
  const heldByOther = (looked: Looked | null, t: number): boolean =>
    looked?.lock != null && looked.lock.owner !== owner && looked.lock.expires > t;

  const writeAll = (fd: number, bytes: Uint8Array): void => {
    for (let off = 0; off < bytes.length; ) off += fs.writeSync(fd, bytes, off, bytes.length - off);
  };
  /** Writes `bytes` to a new file `path` (never replacing one) and flushes it; a failure removes the file. */
  const writeNew = (path: string, bytes: Uint8Array): void => {
    const fd = fs.openSync(path, "wx");
    try {
      writeAll(fd, bytes);
      fs.fsyncSync(fd);
    } catch (e) {
      quietly(() => fs.closeSync(fd));
      quietly(() => fs.unlinkSync(path));
      throw e;
    }
    try {
      fs.closeSync(fd);
    } catch (e) {
      quietly(() => fs.unlinkSync(path));
      throw e;
    }
  };

  /** Takes the lock over `looked` (REQ-SR-002, design D-3); `null` when the compare-and-swap fails. */
  const take = (looked: Looked | null): Held | null => {
    if (heldByOther(looked, clock())) return null;
    pause("take");
    const expires = clock() + ttl;
    if (!Number.isSafeInteger(expires)) throw new RangeError(`lock expiry ${expires} is not a safe integer`);
    const text = lockText(owner, expires);
    writeNew(tmpFile, new TextEncoder().encode(text));
    const n = (looked?.n ?? 0) + 1;
    try {
      fs.linkSync(tmpFile, lockFile(n));
    } catch (e) {
      quietly(() => fs.unlinkSync(tmpFile));
      if (codeOf(e) === "EEXIST") return null;
      throw e;
    }
    quietly(() => fs.unlinkSync(tmpFile));
    try {
      const numbers = lockNumbers();
      const others = numbers.filter((m) => m !== n);
      const other = others.at(-1);
      const holds =
        numbers.at(-1) === n &&
        readLock(n) === text &&
        (looked === null ? other === undefined : other === looked.n && readLock(other) === looked.text);
      if (!holds) {
        quietly(() => fs.unlinkSync(lockFile(n)));
        return null;
      }
      for (const m of others) quietly(() => fs.unlinkSync(lockFile(m)));
      return { n, text, expires };
    } catch (e) {
      quietly(() => fs.unlinkSync(lockFile(n)));
      throw e;
    }
  };
  /** Fencing (REQ-SR-002): the lock is still its own with more than half of the TTL left. */
  const fenced = (mine: Held): boolean => {
    const now = look();
    return now !== null && now.n === mine.n && now.text === mine.text && clock() < mine.expires - ttl / 2;
  };
  /** Release (REQ-SR-002): replaces its own lock file, whole, by an expired lock; never removes a lock file. */
  const release = (mine: Held): void =>
    quietly(() => {
      quietly(() => fs.unlinkSync(tmpFile));
      writeNew(tmpFile, new TextEncoder().encode(lockText(owner, 0)));
      try {
        fs.renameSync(tmpFile, lockFile(mine.n));
      } catch (e) {
        quietly(() => fs.unlinkSync(tmpFile));
        throw e;
      }
    });

  /**
   * Recovers the torn tail under the lock (REQ-SR-004, design D-4): copies it to `recovered/`, fences, cuts. Returns
   * the complete bytes as read under the lock and whether the cut was made (`false`: the check before the cut failed).
   */
  const recoverTail = (mine: Held): { readonly complete: Uint8Array; readonly cut: boolean } => {
    const bytes = readBytes();
    const { complete, tail } = split(bytes);
    if (tail.length === 0) return { complete, cut: true };
    fs.mkdirSync(recoveredDir, { recursive: true });
    for (let i = 0; ; i++) {
      const k = numbered(TORN, fs.readdirSync(recoveredDir)).at(-1) ?? 0;
      try {
        writeNew(join(recoveredDir, `${name}.${k + 1}.torn`), tail);
        break;
      } catch (e) {
        if (codeOf(e) !== "EEXIST" || i >= RETRIES) throw e;
      }
    }
    if (process.platform !== "win32") {
      const fd = fs.openSync(recoveredDir, "r");
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
    pause("fence");
    if (!sameBytes(readBytes(), bytes) || !fenced(mine)) return { complete, cut: false };
    const fd = fs.openSync(file, "r+");
    try {
      fs.ftruncateSync(fd, complete.length);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return { complete, cut: true };
  };

  return {
    read(): StoredLedger {
      for (let i = 0; ; i++) {
        const bytes = readBytes();
        const { complete, tail } = split(bytes);
        if (tail.length === 0) return { commits: commitsOf(complete), torn: null };
        // A torn tail: the lock decides whether it is an append in progress (REQ-SR-001, I-30, I-37). Look, read
        // again, look again; while the lock or the bytes change, start over — after RETRIES rounds of change the tail
        // counts as an append in progress (I-44).
        const first = look();
        const stable = sameBytes(readBytes(), bytes);
        const second = look();
        const settled = stable && sameLock(first, second);
        if (!settled && i < RETRIES) continue;
        if (!settled || heldByOther(second, clock())) return { commits: commitsOf(complete), torn: null };
        if (!recover) return { commits: commitsOf(complete), torn: UTF8.decode(tail) };
        const mine = take(second);
        if (mine === null) return { commits: commitsOf(complete), torn: null };
        try {
          return { commits: commitsOf(recoverTail(mine).complete), torn: null };
        } finally {
          release(mine);
        }
      }
    },

    append(commit: StoredCommit, after: number): AppendResult {
      const mine = take(look());
      if (mine === null) return MOVED;
      try {
        const parts = split(readBytes());
        let complete = parts.complete;
        if (parts.tail.length > 0) {
          if (!recover) return MOVED;
          const recovered = recoverTail(mine);
          if (!recovered.cut) return MOVED;
          complete = recovered.complete;
        }
        const last = commitsOf(complete).at(-1);
        if ((last === undefined ? 0 : last.seq) !== after) return MOVED;
        pause("fence");
        if (!fenced(mine)) return MOVED;
        const fd = fs.openSync(file, "a");
        try {
          writeAll(fd, new TextEncoder().encode(commit.text + "\n"));
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        return { ok: true };
      } finally {
        release(mine);
      }
    },
  };
}
