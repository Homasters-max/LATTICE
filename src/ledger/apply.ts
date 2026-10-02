// Apply (LG-A01, REQ-LG-003, design D-2…D-6): the only path into `knowledge`. Pure — it assigns only `seq`, `rev` and
// `hash` (LG-P01) and reads entities through the latest-revision projection of the opened ledger (LG-J03). A proposal
// that passed the form of LG-P01 answers, in this order: `existing` (LG-C08), the rejections of LG-C07 and LG-P02,
// `no-op` (LG-C05, OM-H03), or one commit of its held intents. `checkTail` checks a commit against the ledger it is
// appended to (LG-C03).

import { canonical } from "../kernel/index.ts";
import type { Ledger } from "./commit.ts";
import { KERNEL_VERSION, recordHash } from "./commit.ts";
import { differs } from "./differs.ts";
import type { Intent, Proposal } from "./proposal.ts";
import { orderedIntents, proposalHash, SESSION_TYPE } from "./proposal.ts";
import type { Commit, LedgerRecord } from "./records.ts";
import type { Rejection } from "./rules.ts";
import { duplicate, reject, sortRejections } from "./rules.ts";

export type Applied =
  | { readonly outcome: "commit"; readonly commit: Commit; readonly text: string }
  | { readonly outcome: "existing"; readonly seq: number }
  | { readonly outcome: "no-op" }
  | { readonly outcome: "rejected"; readonly rejections: readonly Rejection[] };

export type TailCheck =
  | { readonly outcome: "clear" }
  | { readonly outcome: "existing"; readonly seq: number }
  | { readonly outcome: "rejected"; readonly rejections: readonly [Rejection] };

/** OM-H03: the latest revision of the intent's `id` is at its `base`, with its type and record hash; `by` is not compared. */
function isNoOp(ledger: Ledger, intent: Intent): boolean {
  if (intent.kind !== "entity") return false;
  const current = ledger.view.get(intent.id);
  return (
    current !== undefined &&
    current.rev === intent.base &&
    current.type === intent.type &&
    current.hash === recordHash(intent.type, intent.body)
  );
}

const isSession = (intent: Intent): boolean => intent.kind === "event" && intent.type === SESSION_TYPE;

/** LG-C07 (one intent per entity `id`, with `with` and `differs`) and LG-P02 (expected revision), all of them. */
function rejectionsOf(ledger: Ledger, intents: readonly Intent[]): Rejection[] {
  const found: Rejection[] = [];
  const positions = new Map<string, number[]>();
  intents.forEach((intent, i) => positions.set(intent.id, [...(positions.get(intent.id) ?? []), i]));
  for (const [id, at] of positions) {
    if (at.length < 2) continue;
    const paths = differs(at.map((i) => intents[i]));
    for (const i of at.slice(1)) {
      found.push(duplicate("LG-C07", id, `/intents/${i}/id`, "an earlier intent of the proposal names this id", id, paths));
    }
  }
  intents.forEach((intent, i) => {
    if (intent.kind !== "entity") return;
    const current = ledger.view.get(intent.id)?.rev ?? 0;
    if (intent.base !== current) {
      found.push(
        reject("LG-P02", intent.id, `/intents/${i}/base`, "the expected revision is not the latest", current, intent.base),
      );
    }
  });
  return found;
}

export function apply(ledger: Ledger, proposal: Proposal): Applied {
  const held = proposal.intents.filter((intent) => !isNoOp(ledger, intent));
  const heldHash = proposalHash({ intents: held, session: proposal.session });
  const existing = ledger.proposals.get(heldHash);
  if (existing !== undefined) return { outcome: "existing", seq: existing };

  const found = rejectionsOf(ledger, proposal.intents);
  if (found.length > 0) return { outcome: "rejected", rejections: sortRejections(found) };
  if (held.every(isSession)) return { outcome: "no-op" };

  const { at, id: by } = proposal.session;
  const records: LedgerRecord[] = orderedIntents(held).map((x) =>
    x.kind === "entity"
      ? { id: x.id, rev: x.base + 1, type: x.type, hash: recordHash(x.type, x.body), by: x.by, at, body: x.body }
      : { id: x.id, type: x.type, by: x.by, at: x.at, body: x.body },
  );
  const tail = ledger.tail;
  const commit: Commit = {
    seq: tail === null ? 1 : tail.seq + 1,
    prev: tail === null ? null : tail.hash,
    kernel: KERNEL_VERSION,
    base: tail === null ? 0 : tail.seq,
    proposal: heldHash,
    by,
    at,
    records,
  };
  const text = canonical(commit);
  if (!text.ok) throw new Error("commit: not JSON");
  return { outcome: "commit", commit, text: text.value };
}

/** REQ-LG-004: `existing` when the ledger already holds the commit's `proposal`, `clear` on the tail it was built on. */
export function checkTail(ledger: Ledger, commit: Commit): TailCheck {
  const existing = ledger.proposals.get(commit.proposal);
  if (existing !== undefined) return { outcome: "existing", seq: existing };
  const tail = { seq: ledger.tail?.seq ?? 0, hash: ledger.tail?.hash ?? null };
  if (commit.base === tail.seq && commit.prev === tail.hash) return { outcome: "clear" };
  const moved = reject(
    "LG-C03",
    null,
    "",
    "the tail of the ledger is not the one the commit was built on; apply the proposal again",
    { seq: commit.base, hash: commit.prev },
    tail,
  );
  return { outcome: "rejected", rejections: [moved] };
}
