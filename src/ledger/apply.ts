// Apply (LG-A01, REQ-CL-004, design D-5): the only path into `knowledge`. Pure — it assigns only `seq`, `rev` and
// `hash` (LG-P01) and reads entities through the latest-revision projection of the opened ledger (LG-J03). A proposal
// that passed the form of LG-P01 is checked by LG-C07 (an `id` named twice) and LG-P02 (expected revision); a clean
// one becomes exactly one commit.

import { canonical } from "../kernel/index.ts";
import type { Ledger } from "./commit.ts";
import { commitHash, KERNEL_VERSION, recordHash } from "./commit.ts";
import type { EventIntent, Proposal } from "./proposal.ts";
import { orderedIntents, proposalHash, SESSION_TYPE } from "./proposal.ts";
import type { Commit, LedgerRecord } from "./records.ts";
import type { Rejection } from "./rules.ts";
import { reject, sortRejections } from "./rules.ts";

export type Applied =
  | { readonly outcome: "commit"; readonly commit: Commit; readonly text: string; readonly hash: string }
  | { readonly outcome: "rejected"; readonly rejections: readonly Rejection[] };

export function apply(ledger: Ledger, proposal: Proposal): Applied {
  const found: Rejection[] = [];
  const named = new Set<string>();
  proposal.intents.forEach((intent, i) => {
    if (named.has(intent.id)) {
      found.push(reject("LG-C07", intent.id, `/intents/${i}/id`, "an earlier intent of the proposal names this id"));
    }
    named.add(intent.id);
    if (intent.kind === "entity") {
      const current = ledger.view.get(intent.id)?.rev ?? 0;
      if (intent.base !== current) {
        found.push(
          reject("LG-P02", intent.id, `/intents/${i}/base`, "the expected revision is not the latest", current, intent.base),
        );
      }
    }
  });
  if (found.length > 0) return { outcome: "rejected", rejections: sortRejections(found) };

  const session = proposal.intents.find((x) => x.kind === "event" && x.type === SESSION_TYPE) as EventIntent;
  const records: LedgerRecord[] = orderedIntents(proposal.intents).map((x) =>
    x.kind === "entity"
      ? { id: x.id, rev: x.base + 1, type: x.type, hash: recordHash(x.type, x.body), by: x.by, at: session.at, body: x.body }
      : { id: x.id, type: x.type, by: x.by, at: x.at, body: x.body },
  );
  const tail = ledger.tail;
  const commit: Commit = {
    seq: tail === null ? 1 : tail.seq + 1,
    prev: tail === null ? null : tail.hash,
    kernel: KERNEL_VERSION,
    base: tail === null ? 0 : tail.seq,
    proposal: proposalHash(proposal),
    by: session.id,
    at: session.at,
    records,
  };
  const text = canonical(commit);
  if (!text.ok) throw new Error("commit: not JSON");
  return { outcome: "commit", commit, text: text.value, hash: commitHash(commit) };
}
