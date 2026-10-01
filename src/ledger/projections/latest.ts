// The latest-revision projection (LG-J01, design D-5): a fold of the commits in ledger order — the last record of each
// entity `id` wins. It is computed, never stored, and is the only way apply and the codec read entities (LG-J03,
// PL-K05). Records are frozen (SL-T02).

import type { Commit, EntityRecord } from "../records.ts";
import { isEntityRecord } from "../records.ts";

export type ReadView = {
  get(id: string): EntityRecord | undefined;
  /** Every entity at its latest revision, ordered by `id` (UTF-16 code units). */
  entities(): readonly EntityRecord[];
};

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}

export function latest(commits: readonly Commit[]): ReadView {
  const byId = new Map<string, EntityRecord>();
  for (const commit of commits) {
    for (const record of commit.records) {
      if (isEntityRecord(record)) byId.set(record.id, freeze(record));
    }
  }
  const sorted = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { get: (id) => byId.get(id), entities: () => sorted };
}
