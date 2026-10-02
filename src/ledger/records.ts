// The forms of a commit and its records (LG-C02, OM-E01, REQ-CL-004 Commit): plain data, no class per record type
// (ST-M03), frozen once read from the ledger (SL-T02). The entity record is the OM-E01 envelope; the kernel's older
// `Revision` gives way to it with s0-kernel (#55, design I-23).

import type { Hash, Id } from "../kernel/index.ts";
import type { Act } from "./ports/acts.ts";

export type EntityRecord = {
  readonly id: Id;
  readonly rev: number;
  readonly type: string;
  readonly hash: Hash;
  readonly by: Id;
  readonly at: string;
  readonly body: unknown;
};

export type EventRecord = {
  readonly id: Id;
  readonly type: string;
  readonly by: Id;
  readonly at: string;
  readonly body: unknown;
};

export type LedgerRecord = EntityRecord | EventRecord;

export type Commit = {
  readonly seq: number;
  readonly prev: Hash | null;
  readonly kernel: string;
  readonly base: number;
  readonly proposal: Hash;
  readonly by: Id;
  readonly at: string;
  readonly records: readonly LedgerRecord[];
  /** The act record (LG-A05, REQ-LG-003): present only when an act confirms a held intent. */
  readonly acts?: readonly Act[];
};

export function isEntityRecord(r: LedgerRecord): r is EntityRecord {
  return Object.hasOwn(r, "rev");
}

/** Freezes a value read from the ledger and everything in it. */
export function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) frozen(v);
    Object.freeze(value);
  }
  return value;
}

/** Order by UTF-16 code units — the order of `id`s, rule IDs and paths everywhere in the ledger. */
export const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
