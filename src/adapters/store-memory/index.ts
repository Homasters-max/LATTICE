// Memory adapter of the `store` port (LG-S02, REQ-SR-001…004, design D-6): one ledger held in memory and shared by
// every store made on it, so "two writers", an expired lock and fencing are tested without a disk. The lock is a value
// of the shared ledger; the compare-and-swap of a take compares lock identities, so a lock taken again by another
// writer is never mistaken for the one looked at (SCN-SR-011).

import { randomUUID } from "node:crypto";
import type { AppendResult, Store, StoredCommit, StoredLedger } from "../../ledger/ports/store.ts";

export type MemoryLock = { readonly owner: string; readonly expires: number } | { readonly unreadable: true };

/** The shared ledger: complete commit texts, the torn tail, the current lock and the recovered tails in order. */
export type MemoryLedger = { lines: string[]; torn: string | null; lock: MemoryLock | null; recovered: string[] };

export type StoreOptions = {
  readonly owner?: string;
  readonly now?: () => number;
  readonly ttl?: number;
  readonly recover?: boolean;
  /** Test seam (design D-2): `take` after the store looked at the lock, `fence` right before a fencing check. */
  readonly pause?: (point: "take" | "fence") => void;
};

type Held = { readonly owner: string; readonly expires: number };

const OWNER = /^[A-Za-z0-9-]{1,64}$/;
const MOVED: AppendResult = { ok: false, reason: "moved" };

export function memoryLedger(): MemoryLedger {
  return { lines: [], torn: null, lock: null, recovered: [] };
}

function seqOf(text: string): number {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && "seq" in value && typeof value.seq === "number") return value.seq;
  } catch {
    // an unreadable commit: the opener refuses it (LG-C04)
  }
  return Number.NaN;
}

export function memoryStore(ledger: MemoryLedger, options: StoreOptions = {}): Store {
  const owner = options.owner ?? randomUUID();
  const ttl = options.ttl ?? 10_000;
  const recover = options.recover ?? false;
  const pause = options.pause ?? (() => {});
  if (!OWNER.test(owner)) throw new RangeError(`store owner ${JSON.stringify(owner)} is not [A-Za-z0-9-]{1,64}`);
  if (!Number.isSafeInteger(ttl) || ttl < 2) throw new RangeError(`store TTL ${ttl} is not a safe integer >= 2`);

  const clock = (): number => {
    const t = (options.now ?? Date.now)();
    if (!Number.isSafeInteger(t) || t < 0) throw new RangeError(`store clock reading ${t} is not a safe integer >= 0`);
    return t;
  };
  const commits = (lines: readonly string[]): StoredCommit[] => lines.map((text) => ({ seq: seqOf(text), text }));
  const heldByOther = (lock: MemoryLock | null, t: number): boolean =>
    lock !== null && "owner" in lock && lock.owner !== owner && lock.expires > t;

  /** Takes the lock over `looked` (REQ-SR-002); `null` when another owner holds it or it changed since the look. */
  const take = (looked: MemoryLock | null): Held | null => {
    if (heldByOther(looked, clock())) return null;
    pause("take");
    if (ledger.lock !== looked) return null;
    const expires = clock() + ttl;
    if (!Number.isSafeInteger(expires)) throw new RangeError(`lock expiry ${expires} is not a safe integer`);
    const mine: Held = Object.freeze({ owner, expires });
    ledger.lock = mine;
    return mine;
  };
  const fenced = (mine: Held): boolean => ledger.lock === mine && clock() < mine.expires - ttl / 2;
  const release = (mine: Held): void => {
    if (ledger.lock === mine) ledger.lock = null;
  };

  /** Recovers the torn tail under the lock (REQ-SR-004); `false` when the check before the cut fails. */
  const recoverTail = (mine: Held): boolean => {
    const tail = ledger.torn;
    if (tail === null) return true;
    const length = ledger.lines.length;
    ledger.recovered.push(tail);
    pause("fence");
    if (!fenced(mine) || ledger.torn !== tail || ledger.lines.length !== length) return false;
    ledger.torn = null;
    return true;
  };

  return {
    read(): StoredLedger {
      const before = ledger.lines.slice();
      if (ledger.torn === null) return { commits: commits(before), torn: null };
      const looked = ledger.lock;
      if (heldByOther(looked, clock())) return { commits: commits(before), torn: null };
      if (!recover) return { commits: commits(before), torn: ledger.torn };
      const mine = take(looked);
      if (mine === null) return { commits: commits(before), torn: null };
      try {
        const under = ledger.lines.slice();
        recoverTail(mine);
        return { commits: commits(under), torn: null };
      } finally {
        release(mine);
      }
    },

    append(commit: StoredCommit, after: number): AppendResult {
      const mine = take(ledger.lock);
      if (mine === null) return MOVED;
      try {
        if (ledger.torn !== null && !(recover && recoverTail(mine))) return MOVED;
        const last = ledger.lines.at(-1);
        if ((last === undefined ? 0 : seqOf(last)) !== after) return MOVED;
        pause("fence");
        if (!fenced(mine)) return MOVED;
        ledger.lines.push(commit.text);
        return { ok: true };
      } finally {
        release(mine);
      }
    },
  };
}
