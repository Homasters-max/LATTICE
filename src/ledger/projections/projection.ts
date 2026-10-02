// The shapes every projection shares (REQ-PJ-002, REQ-PJ-004, design D-2, D-3): an edge of the referrers, the
// revisions a commit is folded against, and a projection — a named fold over commits with its own state.

import type { Commit, EntityRecord } from "../records.ts";

/** A reference from `from` (`id@rev` of an entity revision, or an event `id`) at `path` of the record (OM-R05). */
export type Edge = { readonly from: string; readonly path: string; readonly ref: string };

/** Every revision of every entity, in ledger order, as it stands after the commit being folded (REQ-PJ-001). */
export type Revisions = {
  /** The last revision of `id` whose `rev` is `rev`. */
  revision(id: string, rev: number): EntityRecord | undefined;
  /** Every revision of `id` in ledger order. */
  all(id: string): readonly EntityRecord[];
};

/**
 * A projection: a fold of commits into a state of its own. It reads only the commit, the revisions and its state —
 * never another projection — so the order of the list does not matter (REQ-PJ-004).
 */
export type Projection<S> = {
  readonly name: string;
  empty(): S;
  /** A copy that a later `fold` may change without changing `state` (REQ-PJ-003). */
  copy(state: S): S;
  /** Folds one commit into `state`, in place. */
  fold(state: S, commit: Commit, revisions: Revisions): void;
  /** A JSON value: object keys are sorted by the canonical form, arrays are in the order the spec gives. */
  serialize(state: S): unknown;
};
