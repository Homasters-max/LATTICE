// Module `ledger` (design-next ST-M01, design D-1): proposals, apply, commits, the latest-revision projection and the
// `store` and `acts` port interfaces (ports/).

export type { Commit, EntityRecord, EventRecord, LedgerRecord } from "./records.ts";
export type { Ledger, Opened } from "./commit.ts";
export { commitHash, KERNEL_VERSION, openLedger } from "./commit.ts";
export type { EntityIntent, EventIntent, Intent, Parsed, Proposal } from "./proposal.ts";
export { isName, orderedIntents, parseProposal, proposalHash, proposalText, SESSION_TYPE } from "./proposal.ts";
export type { Applied } from "./apply.ts";
export { apply } from "./apply.ts";
export type { ReadView } from "./projections/latest.ts";
export type { Rejection, RuleId } from "./rules.ts";
export { REJECTION_RULES } from "./rules.ts";
