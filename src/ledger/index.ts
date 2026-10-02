// Module `ledger` (design-next ST-M01, design D-1): proposals, apply, opening a ledger with its latest-revision
// projection, and the `store` and `acts` port interfaces (ports/).

export type { EntityRecord } from "./records.ts";
export type { Ledger } from "./commit.ts";
export { openLedger } from "./commit.ts";
export type { Intent, Proposal } from "./proposal.ts";
export { parseProposal, proposalHash, proposalText, SESSION_TYPE, unreadableProposal } from "./proposal.ts";
export type { Applied, TailCheck } from "./apply.ts";
export { apply, checkTail } from "./apply.ts";
export { differs } from "./differs.ts";
export type { ReadView } from "./projections/latest.ts";
export type { Rejection } from "./rules.ts";
export { REJECTION_RULES } from "./rules.ts";
