// One harness per adapter of the `store` port (design D-7): the contract tests drive both through the same operations,
// and a harness also plays the outside world — a crashed writer's torn tail, a lock left behind, another writer's lock.

import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Store } from "../../src/ledger/ports/store.ts";
import type { StoreOptions } from "../../src/adapters/store-jsonl/index.ts";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";
import { memoryLedger, memoryStore } from "../../src/adapters/store-memory/index.ts";

/** The current lock as the harness sees it: a readable lock, an unreadable one, or none. */
export type Current = { readonly owner: string; readonly expires: number } | "unreadable" | null;

export type Harness = {
  readonly name: "jsonl" | "memory";
  make(options?: StoreOptions): Store;
  /** The ledger holds exactly these commit texts, each with its end marker, and nothing else. */
  seed(texts: readonly string[]): void;
  /** Leaves `text` after the last commit, without an end marker (a crashed writer). */
  tear(text: string): void;
  /** The torn tail gains its end marker (the writer that was writing it completed). */
  completeTorn(): void;
  /** Another writer takes the lock: a new current lock of `owner` expiring at `expires`. */
  lock(owner: string, expires: number): void;
  /** A current lock that cannot be read as a lock. */
  unreadableLock(): void;
  /** Every lock is removed and `owner` takes a new lock in the place of the current one (SCN-SR-011). */
  replaceLock(owner: string, expires: number): void;
  /** Every lock is removed. */
  removeLocks(): void;
  current(): Current;
  /** True when a lock that has not expired at `t` is current. */
  held(t: number): boolean;
  /** The recovered tails, in recovery order. */
  recovered(): string[];
  /** The ledger as bytes the store does not interpret: commits and torn tail. */
  raw(): string;
  dispose(): void;
};

const lockText = (owner: string, expires: number): string => JSON.stringify({ expires, owner }) + "\n";

function heldAt(current: Current, t: number): boolean {
  return current !== null && current !== "unreadable" && current.expires > t;
}

export function memoryHarness(): Harness {
  const ledger = memoryLedger();
  const current = (): Current => {
    const lock = ledger.lock;
    if (lock === null) return null;
    return "owner" in lock ? { owner: lock.owner, expires: lock.expires } : "unreadable";
  };
  return {
    name: "memory",
    make: (options = {}) => memoryStore(ledger, options),
    seed(texts) {
      ledger.lines = [...texts];
      ledger.torn = null;
    },
    tear(text) {
      ledger.torn = (ledger.torn ?? "") + text;
    },
    completeTorn() {
      if (ledger.torn !== null) ledger.lines.push(ledger.torn);
      ledger.torn = null;
    },
    lock(owner, expires) {
      ledger.lock = { owner, expires };
    },
    unreadableLock() {
      ledger.lock = { unreadable: true };
    },
    replaceLock(owner, expires) {
      ledger.lock = { owner, expires };
    },
    removeLocks() {
      ledger.lock = null;
    },
    current,
    held: (t) => heldAt(current(), t),
    recovered: () => [...ledger.recovered],
    raw: () => ledger.lines.map((l) => l + "\n").join("") + (ledger.torn ?? ""),
    dispose() {},
  };
}

export function jsonlHarness(): Harness & { readonly dir: string; readonly file: string } {
  const dir = mkdtempSync(join(tmpdir(), "lattice-store-"));
  const file = join(dir, "knowledge.jsonl");
  writeFileSync(file, "");
  const numbers = (): number[] =>
    readdirSync(dir)
      .flatMap((n) => {
        const m = /^knowledge\.jsonl\.lock\.([1-9][0-9]*)$/.exec(n);
        return m === null ? [] : [Number(m[1])];
      })
      .sort((a, b) => a - b);
  const writeLock = (n: number, text: string): void => writeFileSync(join(dir, `knowledge.jsonl.lock.${n}`), text);
  const removeLocks = (): void => {
    for (const n of numbers()) unlinkSync(join(dir, `knowledge.jsonl.lock.${n}`));
  };
  const current = (): Current => {
    const n = numbers().at(-1);
    if (n === undefined) return null;
    const text = readFileSync(join(dir, `knowledge.jsonl.lock.${n}`), "utf8");
    try {
      const v = JSON.parse(text) as { owner: unknown; expires: unknown };
      if (typeof v.owner === "string" && typeof v.expires === "number" && lockText(v.owner, v.expires) === text) {
        return { owner: v.owner, expires: v.expires };
      }
    } catch {
      // unreadable
    }
    return "unreadable";
  };
  return {
    name: "jsonl",
    dir,
    file,
    make: (options = {}) => jsonlStore(file, options),
    seed: (texts) => writeFileSync(file, texts.map((t) => t + "\n").join("")),
    tear: (text) => appendFileSync(file, text),
    completeTorn: () => appendFileSync(file, "\n"),
    lock: (owner, expires) => writeLock((numbers().at(-1) ?? 0) + 1, lockText(owner, expires)),
    unreadableLock: () => writeLock((numbers().at(-1) ?? 0) + 1, "not a lock"),
    replaceLock(owner, expires) {
      const n = numbers().at(-1) ?? 1;
      removeLocks();
      writeLock(n, lockText(owner, expires));
    },
    removeLocks,
    current,
    held: (t) => heldAt(current(), t),
    recovered() {
      const folder = join(dir, "recovered");
      let names: string[];
      try {
        names = readdirSync(folder);
      } catch {
        return [];
      }
      return names
        .flatMap((n) => {
          const m = /^knowledge\.jsonl\.([1-9][0-9]*)\.torn$/.exec(n);
          return m === null ? [] : [{ n: Number(m[1]), file: n }];
        })
        .sort((a, b) => a.n - b.n)
        .map(({ file: f }) => readFileSync(join(folder, f), "utf8"));
    },
    raw: () => readFileSync(file, "utf8"),
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export const harnesses: readonly (() => Harness)[] = [jsonlHarness, memoryHarness];

/** A settable clock for the stores of a test. */
export function clock(start = 0): { now: () => number; set(t: number): void } {
  let t = start;
  return { now: () => t, set: (v) => void (t = v) };
}

/** Commit texts the store does not interpret beyond `seq`. */
export const commit = (seq: number): string => JSON.stringify({ seq, body: `commit ${seq} abcdefghijklmnopqrstuvwxyz` });
