// Store init (LG-G04, LG-A07, CT-N05, PL-A01, REQ-LG-008, REQ-LG-010, design D-4, D-8): the four proposals that
// `lattice init` applies in order — genesis, `std`, the project namespace, `setup@1` with its `live` fact —, and the
// shape opening a store checks them by. Pure: the caller gives the `at`, the four ULIDs and the package.

import type { Id } from "../kernel/index.ts";
import { newId } from "../kernel/index.ts";
import { LIVE_TYPE } from "../trust/index.ts";
import { GENESIS, INIT_SESSION_BODY, isInitSession } from "./genesis.ts";
import type { EntityIntent, EventIntent, Proposal } from "./proposal.ts";
import { SESSION_TYPE } from "./proposal.ts";
import type { Commit } from "./records.ts";
import { frozen, isEntityRecord } from "./records.ts";
import type { StdEntity } from "./std.ts";
import { packageHash, STD_HASH, stdProposal } from "./std.ts";

export type InitInput = {
  readonly namespace: string;
  readonly owner: string;
  readonly at: string;
  readonly ulids: readonly [string, string, string, string];
  readonly std: readonly StdEntity[];
};

export type InitProposals = { readonly ok: true; readonly proposals: readonly Proposal[] } | { readonly ok: false; readonly message: string };

/** The number of commits store init writes (LG-G04). */
export const INIT_COMMITS = 4;

const NAMESPACE_TYPE = "std/namespace@1";
const SETUP_TYPE = "std/setup@1";

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
    intents: [entity(`${ns}/namespace`, NAMESPACE_TYPE, nsSession, { owner: input.owner, writers: [{ login: input.owner }], owner_acts: [] }), nsEvent],
    session: nsEvent,
  };

  const setupEvent = sessionOf(setupSession);
  const ports = Object.fromEntries(PORTS.map((p) => [p, { mode: "fixture", memo: false }]));
  const live: EventIntent = {
    kind: "event",
    id: liveId,
    type: LIVE_TYPE,
    by: setupSession,
    at: input.at,
    body: { of: { subject: `${ns}/setup@1` }, key: { id: `${ns}/setup` }, value: 1 },
  };
  const setup: Proposal = {
    intents: [entity(`${ns}/setup`, SETUP_TYPE, setupSession, { ports }), live, setupEvent],
    session: setupEvent,
  };

  return { ok: true, proposals: frozen([GENESIS, stdProposal(input.std, { id: stdSession, at: input.at }), namespace, setup]) };
}

/**
 * Whether a commit holds, besides its session event, exactly the entity `id` of `type` at `rev` 1 and events of the
 * types `events` — or, for `entity` `null`, the load of the `std` package in a `machine` / `init` session, by the
 * conditions of its exemption (REQ-LG-002, REQ-LG-010).
 */
function holds(c: Commit, entity: { id: string; type: string } | null, events: readonly string[]): boolean {
  const session = c.records.find((r) => r.id === c.by);
  if (session === undefined || isEntityRecord(session)) return false;
  if (entity === null && !isInitSession(session.body)) return false;
  const rest = c.records.filter((r) => r !== session);
  const entities = rest.filter(isEntityRecord);
  const others = rest.filter((r) => !isEntityRecord(r)).map((r) => r.type).sort();
  if (others.join("\n") !== [...events].sort().join("\n")) return false;
  if (entity === null) return entities.length > 0 && packageHash(entities) === STD_HASH;
  const e = entities[0];
  return entities.length === 1 && e !== undefined && e.id === entity.id && e.rev === 1 && e.type === entity.type;
}

/**
 * The refusal of init commit `i` (1, 2 or 3 — the commit after genesis at that position) of a store of `namespace`, or
 * `null` when it is the one store init writes: `LG-G02` for the load of `std`, `LG-G04` for the namespace and `setup`.
 */
export function initCommitRefusal(c: Commit, i: number, namespace: string): { readonly rule: string; readonly why: string } | null {
  if (i === 1 && !holds(c, null, [])) return { rule: "LG-G02", why: "the second commit is not a load of the std package of this LATTICE version" };
  if (i === 2 && !holds(c, { id: `${namespace}/namespace`, type: NAMESPACE_TYPE }, [])) {
    return { rule: "LG-G04", why: `the third commit does not create the namespace ${namespace} of store/lattice.json` };
  }
  if (i === 3 && !holds(c, { id: `${namespace}/setup`, type: SETUP_TYPE }, [LIVE_TYPE])) {
    return { rule: "LG-G04", why: `the fourth commit does not write ${namespace}/setup@1 and its live fact` };
  }
  return null;
}
