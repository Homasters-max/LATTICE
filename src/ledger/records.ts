// The forms of a commit and its records (LG-C02, OM-E01, REQ-CL-004 Commit): plain frozen data, no class per record
// type (ST-M03).

export type EntityRecord = {
  readonly id: string;
  readonly rev: number;
  readonly type: string;
  readonly hash: string;
  readonly by: string;
  readonly at: string;
  readonly body: unknown;
};

export type EventRecord = {
  readonly id: string;
  readonly type: string;
  readonly by: string;
  readonly at: string;
  readonly body: unknown;
};

export type LedgerRecord = EntityRecord | EventRecord;

export type Commit = {
  readonly seq: number;
  readonly prev: string | null;
  readonly kernel: string;
  readonly base: number;
  readonly proposal: string;
  readonly by: string;
  readonly at: string;
  readonly records: readonly LedgerRecord[];
};

export function isEntityRecord(r: LedgerRecord): r is EntityRecord {
  return Object.hasOwn(r, "rev");
}
