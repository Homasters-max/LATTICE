// Store init (LG-G04, LG-A07, CT-N05, PL-A01, REQ-LG-008, design D-4): the four proposals that `lattice init` applies in
// order — genesis, `std`, the project namespace, `setup@1` with its `live` fact. Pure: the caller gives the `at`, the
// four ULIDs and the package.

import type { Id } from "../kernel/index.ts";
import { newId } from "../kernel/index.ts";
import { GENESIS, INIT_SESSION_BODY } from "./genesis.ts";
import type { EntityIntent, EventIntent, Proposal } from "./proposal.ts";
import { SESSION_TYPE } from "./proposal.ts";
import { frozen } from "./records.ts";
import type { StdEntity } from "./std.ts";
import { stdProposal } from "./std.ts";

export type InitInput = {
  readonly namespace: string;
  readonly owner: string;
  readonly at: string;
  readonly ulids: readonly [string, string, string, string];
  readonly std: readonly StdEntity[];
};

export type InitProposals = { readonly ok: true; readonly proposals: readonly Proposal[] } | { readonly ok: false; readonly message: string };

/** The ports of `setup` (PL-K01) — each on `fixture`, memoization off: no adapter block serves `service` in S0. */
const PORTS = ["clock", "ids", "judge", "llm", "source"] as const;

export function initProposals(input: InitInput): InitProposals {
  const ids: Id[] = [];
  for (const [i, [namespace, ulid]] of [
    ["std", input.ulids[0]],
    [input.namespace, input.ulids[1]],
    [input.namespace, input.ulids[2]],
    [input.namespace, input.ulids[3]],
  ].entries()) {
    const id = newId(namespace as string, ulid as string);
    if (!id.ok) return { ok: false, message: `store init: id ${i + 1} from ${namespace}/${ulid} is refused by the kernel` };
    ids.push(id.value);
  }
  const [stdSession, nsSession, setupSession, liveId] = ids as [Id, Id, Id, Id];
  const ns = input.namespace;
  const sessionOf = (id: Id): EventIntent => ({ kind: "event", id, type: SESSION_TYPE, by: id, at: input.at, body: INIT_SESSION_BODY });
  const entity = (id: string, type: string, by: Id, body: unknown): EntityIntent => ({ kind: "entity", id: id as Id, type, base: 0, by, body });

  const nsEvent = sessionOf(nsSession);
  const namespace: Proposal = {
    intents: [entity(`${ns}/namespace`, "std/namespace@1", nsSession, { owner: input.owner, writers: [{ login: input.owner }], owner_acts: [] }), nsEvent],
    session: nsEvent,
  };

  const setupEvent = sessionOf(setupSession);
  const ports = Object.fromEntries(PORTS.map((p) => [p, { mode: "fixture", memo: false }]));
  const live: EventIntent = {
    kind: "event",
    id: liveId,
    type: "std/live@1",
    by: setupSession,
    at: input.at,
    body: { of: { subject: `${ns}/setup@1` }, key: { id: `${ns}/setup` }, value: 1 },
  };
  const setup: Proposal = {
    intents: [entity(`${ns}/setup`, "std/setup@1", setupSession, { ports }), live, setupEvent],
    session: setupEvent,
  };

  return { ok: true, proposals: frozen([GENESIS, stdProposal(input.std, { id: stdSession, at: input.at }), namespace, setup]) };
}
