// The read view (LG-J01…J04, REQ-PJ-001, REQ-PJ-003, REQ-PJ-004, design D-3, D-4, D-7): one fold of the revisions,
// then every projection of the list over each commit; extended by one commit on its tail, serialized canonically.

import { canonical } from "../../kernel/index.ts";
import type { Commit, EntityRecord } from "../records.ts";
import { byCodeUnits, isEntityRecord } from "../records.ts";
import type { Edge, Projection, Revisions } from "./projection.ts";
import type { ReferrersState } from "./referrers.ts";
import { referrers, referrersOf } from "./referrers.ts";

export type ReadView = {
  /** The `seq` of the last commit folded; `0` for none. */
  readonly seq: number;
  get(id: string): EntityRecord | undefined;
  /** Every entity at its last revision, ordered by `id` (UTF-16 code units). */
  entities(): readonly EntityRecord[];
  revision(id: string, rev: number): EntityRecord | undefined;
  referrers(id: string): readonly Edge[];
};

/** The latest revision of every entity (LG-J01): the last record of each `id` in ledger order. */
const latest: Projection<Map<string, EntityRecord>> = {
  name: "latest",
  empty: () => new Map(),
  copy: (state) => new Map(state),
  fold(state, commit) {
    for (const record of commit.records) if (isEntityRecord(record)) state.set(record.id, record);
  },
  serialize: (state) =>
    Object.fromEntries(
      [...state.keys()].sort(byCodeUnits).map((id) => {
        const { rev, type, hash } = state.get(id) as EntityRecord;
        return [id, { hash, rev, type }];
      }),
    ),
};

// The list is heterogeneous: each projection is called only with the state it made itself.
type AnyProjection = Projection<any>;

/** The projections of a view (REQ-PJ-004); `rebuild` takes any permutation of it. */
export const PROJECTIONS: readonly AnyProjection[] = Object.freeze([latest, referrers]);

type State = {
  seq: number;
  /** Revisions of every entity in ledger order; an array is replaced, never changed, when a revision is added. */
  readonly revisions: Map<string, readonly EntityRecord[]>;
  readonly list: readonly AnyProjection[];
  readonly states: Map<AnyProjection, unknown>;
};

const STATES = new WeakMap<ReadView, State>();

function revisionsOf(state: State): Revisions {
  return {
    revision: (id, rev) => state.revisions.get(id)?.findLast((r) => r.rev === rev),
    all: (id) => state.revisions.get(id) ?? [],
  };
}

/** Folds one commit into `state`, in place (design D-4). */
function step(state: State, commit: Commit): void {
  for (const record of commit.records) {
    if (isEntityRecord(record)) state.revisions.set(record.id, [...(state.revisions.get(record.id) ?? []), record]);
  }
  const revisions = revisionsOf(state);
  for (const projection of state.list) projection.fold(state.states.get(projection), commit, revisions);
  state.seq = commit.seq;
}

function viewOf(state: State): ReadView {
  const current = state.states.get(latest) as Map<string, EntityRecord>;
  const index = state.states.get(referrers) as ReferrersState;
  let sorted: readonly EntityRecord[] | null = null;
  const view: ReadView = Object.freeze({
    seq: state.seq,
    get: (id: string) => current.get(id),
    entities: () =>
      (sorted ??= Object.freeze([...current.values()].sort((a, b) => byCodeUnits(a.id, b.id)))),
    revision: (id: string, rev: number) => revisionsOf(state).revision(id, rev),
    referrers: (id: string) => referrersOf(index, id),
  });
  STATES.set(view, state);
  return view;
}

function stateOf(view: ReadView): State {
  const state = STATES.get(view);
  if (state === undefined) throw new Error("projections: not a view that rebuild or extend returned");
  return state;
}

function isPermutation(list: readonly AnyProjection[]): boolean {
  return list.length === PROJECTIONS.length && new Set(list).size === list.length && list.every((p) => PROJECTIONS.includes(p));
}

/** The view of `commits` folded in ledger order (REQ-PJ-001); `list` is a permutation of PROJECTIONS (REQ-PJ-004). */
export function rebuild(commits: readonly Commit[], list: readonly AnyProjection[] = PROJECTIONS): ReadView {
  if (!isPermutation(list)) throw new Error("projections: the list is not a permutation of PROJECTIONS");
  const state: State = {
    seq: 0,
    revisions: new Map(),
    list: Object.freeze([...list]),
    states: new Map(list.map((projection) => [projection, projection.empty()])),
  };
  for (const commit of commits) step(state, commit);
  return viewOf(state);
}

export type Extended =
  | { readonly ok: true; readonly view: ReadView }
  | { readonly ok: false; readonly tail: number; readonly base: number; readonly seq: number };

/** The view with one more commit, on its tail only (LG-J03, REQ-PJ-003); `view` does not change. */
export function extend(view: ReadView, commit: Commit): Extended {
  const state = stateOf(view);
  if (commit.base !== state.seq || !(commit.seq > commit.base)) {
    return { ok: false, tail: state.seq, base: commit.base, seq: commit.seq };
  }
  const next: State = {
    seq: state.seq,
    revisions: new Map(state.revisions),
    list: state.list,
    states: new Map(state.list.map((projection) => [projection, projection.copy(state.states.get(projection))])),
  };
  step(next, commit);
  return { ok: true, view: viewOf(next) };
}

/** The canonical form of `seq` and every projection by its name (REQ-PJ-004, design D-7). */
export function serialize(view: ReadView): string {
  const state = stateOf(view);
  const value: Record<string, unknown> = { seq: state.seq };
  for (const projection of state.list) value[projection.name] = projection.serialize(state.states.get(projection));
  const text = canonical(value);
  if (!text.ok) throw new Error("projections: the view is not JSON");
  return text.value;
}
