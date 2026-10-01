// The latest-revision projection (LG-J01, design D-5): a fold of the commits in ledger order — the last record of each
// entity `id` wins. It is computed, never stored, and is the only way apply and the codec read entities (LG-J03,
// PL-K05).

import type { Commit, EntityRecord } from "../records.ts";
import { byCodeUnits, isEntityRecord } from "../records.ts";

export type ReadView = {
  get(id: string): EntityRecord | undefined;
  /** Every entity at its latest revision, ordered by `id` (UTF-16 code units). */
  entities(): readonly EntityRecord[];
};

export function latest(commits: readonly Commit[]): ReadView {
  const byId = new Map<string, EntityRecord>();
  for (const commit of commits) {
    for (const record of commit.records) if (isEntityRecord(record)) byId.set(record.id, record);
  }
  const sorted = [...byId.values()].sort((a, b) => byCodeUnits(a.id, b.id));
  return { get: (id) => byId.get(id), entities: () => sorted };
}
