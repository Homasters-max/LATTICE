// Referrers (OM-R05, REQ-PJ-002, design D-4…D-6): the reverse index of every reference — `/type`, the roles of an
// event's `of` and the references its type declares — from the last revision of every entity and from every event.

import type { Type } from "../../kernel/index.ts";
import { admit, canonical, formatRef, metaType, parseRef, typeOf } from "../../kernel/index.ts";
import type { Commit, EntityRecord, LedgerRecord } from "../records.ts";
import { byCodeUnits, isEntityRecord } from "../records.ts";
import type { Edge, Projection, Revisions } from "./projection.ts";

const META = "core/type@1";
/** The walk of `extends` stops at six records: `typeOf` refuses more than five (REQ-KR-014). */
const MAX_WALK = 6;

/** The edges of each source, and the sources that name each target `id`. */
export type ReferrersState = {
  readonly bySource: Map<string, readonly Edge[]>;
  readonly byTarget: Map<string, Set<string>>;
};

const isObject = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** One JSON Pointer token (RFC 6901). */
const token = (key: string): string => key.replace(/~/g, "~0").replace(/\//g, "~1");

/** The `id` a reference string names. */
function targetOf(ref: string): string {
  const parsed = parseRef(ref);
  if (!parsed.ok) throw new Error(`referrers: not a reference: ${ref}`);
  return parsed.value.id;
}

/** The type `T@n` resolved from the revisions (REQ-PJ-002), or `null`; `types` caches it for one commit. */
function resolve(type: string, revisions: Revisions, types: Map<string, Type | null>): Type | null {
  if (type === META) return metaType;
  const cached = types.get(type);
  if (cached !== undefined) return cached;
  let resolved: Type | null = null;
  const ref = parseRef(type);
  const first = ref.ok && ref.value.version !== undefined ? revisions.revision(ref.value.id, ref.value.version) : undefined;
  if (first !== undefined) {
    const chain: EntityRecord[] = [first];
    let complete = true;
    while (chain.length < MAX_WALK) {
      const body = (chain[chain.length - 1] as EntityRecord).body;
      const parent = isObject(body) && typeof body.extends === "string" ? parseRef(body.extends) : null;
      if (parent === null || !parent.ok || parent.value.version === undefined) break;
      const next = revisions.revision(parent.value.id, parent.value.version);
      if (next === undefined) {
        complete = false;
        break;
      }
      chain.push(next);
    }
    const typed = complete ? typeOf(chain) : null;
    resolved = typed !== null && typed.ok ? typed.value : null;
  }
  types.set(type, resolved);
  return resolved;
}

/** The references of a record, one per path (REQ-PJ-002 steps 1–3). */
function referencesOf(record: LedgerRecord, revisions: Revisions, types: Map<string, Type | null>): Map<string, string> {
  const found = new Map<string, string>();
  if (parseRef(record.type).ok) found.set("/type", record.type);
  const body = record.body;
  if (!isEntityRecord(record) && isObject(body) && isObject(body.of)) {
    const of = body.of;
    for (const role of Object.keys(of).sort(byCodeUnits)) {
      const value = of[role];
      if (typeof value === "string" && parseRef(value).ok) found.set(`/body/of/${token(role)}`, value);
    }
  }
  const type = resolve(record.type, revisions, types);
  const text = type === null ? null : canonical(body);
  const admitted = type !== null && text !== null && text.ok ? admit(text.value, type) : null;
  if (admitted !== null && admitted.ok) {
    for (const { path, ref } of admitted.value.refs) {
      const written = formatRef(ref.id, ref.version);
      if (written.ok) found.set(`/body${path}`, written.value);
    }
  }
  return found;
}

function removeSource(state: ReferrersState, from: string): void {
  for (const edge of state.bySource.get(from) ?? []) {
    const target = targetOf(edge.ref);
    const sources = state.byTarget.get(target);
    sources?.delete(from);
    if (sources?.size === 0) state.byTarget.delete(target);
  }
  state.bySource.delete(from);
}

function addEdges(state: ReferrersState, from: string, references: ReadonlyMap<string, string>): void {
  const edges = new Map<string, Edge>();
  for (const edge of state.bySource.get(from) ?? []) edges.set(`${edge.path}\u0000${edge.ref}`, edge);
  for (const [path, ref] of references) {
    edges.set(`${path}\u0000${ref}`, Object.freeze({ from, path, ref }));
    const target = targetOf(ref);
    const sources = state.byTarget.get(target) ?? new Set<string>();
    sources.add(from);
    state.byTarget.set(target, sources);
  }
  if (edges.size > 0) state.bySource.set(from, Object.freeze([...edges.values()]));
}

const byEdge = (a: Edge, b: Edge): number => byCodeUnits(a.from, b.from) || byCodeUnits(a.path, b.path) || byCodeUnits(a.ref, b.ref);

/** The edges whose target is `id`, ordered by `from`, `path`, `ref` (REQ-PJ-002). */
export function referrersOf(state: ReferrersState, id: string): readonly Edge[] {
  const edges: Edge[] = [];
  for (const from of state.byTarget.get(id) ?? []) {
    for (const edge of state.bySource.get(from) ?? []) if (targetOf(edge.ref) === id) edges.push(edge);
  }
  return Object.freeze(edges.sort(byEdge));
}

export const referrers: Projection<ReferrersState> = {
  name: "referrers",
  empty: () => ({ bySource: new Map(), byTarget: new Map() }),
  copy: (state) => ({
    bySource: new Map(state.bySource),
    byTarget: new Map([...state.byTarget].map(([target, sources]) => [target, new Set(sources)])),
  }),
  fold(state: ReferrersState, commit: Commit, revisions: Revisions): void {
    const types = new Map<string, Type | null>();
    for (const record of commit.records) {
      const references = referencesOf(record, revisions, types);
      if (isEntityRecord(record)) {
        const all = revisions.all(record.id);
        const before = all[all.indexOf(record) - 1];
        if (before !== undefined) removeSource(state, `${before.id}@${before.rev}`);
        addEdges(state, `${record.id}@${record.rev}`, references);
      } else {
        addEdges(state, record.id, references);
      }
    }
  },
  serialize: (state) =>
    Object.fromEntries([...state.byTarget.keys()].sort(byCodeUnits).map((target) => [target, referrersOf(state, target)])),
};
