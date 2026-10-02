// The entry of the projections (LG-J01, LG-J04, design D-1 of s0-projections): `openLedger` builds the read view of an
// opened ledger with `latest(commits)` — the view at the latest commit: latest revision, every revision and referrers,
// rebuilt in memory on every opening. It is the only way apply and the codec read entities (LG-J03, PL-K05).

import type { Commit } from "../records.ts";
import type { ReadView } from "./view.ts";
import { rebuild } from "./view.ts";

export type { ReadView } from "./view.ts";

export function latest(commits: readonly Commit[]): ReadView {
  return rebuild(commits);
}
