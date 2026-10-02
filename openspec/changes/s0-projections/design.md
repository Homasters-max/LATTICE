# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/projections/spec.md` of this Change. Today (after `s0-skeleton` #54,
`s0-apply-checks` #56, `s0-kernel` #55, `s0-store-2` #57):
- `src/ledger/projections/latest.ts` — `latest(commits): ReadView`, a fold where the last entity record of each `id`
  wins; `ReadView = { get(id), entities() }`.
- `src/ledger/commit.ts` — `openLedger(stored)` verifies the chain (LG-C04) and returns `{ tail, view: latest(commits),
  proposals }`; `src/ledger/index.ts` exports the type `ReadView` from `./projections/latest.ts`.
- Readers of the view: `src/ledger/apply.ts` (`view.get`, REQ-LG-002…003) and `src/codec/export.ts` (`view.get`,
  `view.entities`, REQ-CL-005).
- The kernel gives `admit(text, type)` with `refs` (REQ-KR-013, REQ-KR-015), `typeOf(chain)` (REQ-KR-014), `metaType`
  (`core/type@1`, REQ-KR-016), `parseRef` / `formatRef` (REQ-KR-012) and `canonical` (REQ-KR-010).
- The ledger holds no type records yet: `import-md` writes rows of `lattice/table.<…>@1` and documents of
  `lattice/document@1` whose `rows` are `$ref` markers (not references, NX-15); types arrive with `s0-bootstrap` (#59).
- CI: `.github/workflows/test.yml` has one job `test` on `ubuntu-latest`; `main` requires `test` and `warrant / warrant`.
- `.gitattributes` is `* text=auto eol=lf`: text files check out with LF on Windows too.

## Goals / Non-Goals

**Goals:**
- Referrers (OM-R05) and the latest revision as projections of one list, rebuilt from the ledger (LG-J01).
- Byte-identical rebuilds checked three ways (LG-J02) against frozen reference ledgers in git.
- No source path shared with a parallel Change (SL-T08): only `src/ledger/projections/**` and its tests.

**Non-Goals:**
- Everything proposal.md, Non-goals, names: uniqueness, in force, findings (later Changes), LG-J05, a disk cache, alias
  resolution, target existence.
- Performance: a rebuild admits every record once per opening (D-4); S0 stores are small (LT-11 is the trigger).

## Decisions

### D-1. Paths: `src/ledger/projections/**` only; `latest.ts` stays the entry

`s0-bootstrap` (#59) changes `src/ledger/commit.ts` (commit field `acts`, genesis check) and `src/ledger/index.ts` in
parallel. So this Change edits neither: `openLedger` keeps `view: latest(commits)`, and `latest` now returns the full
view (`rebuild(commits)`); `index.ts` keeps exporting the type `ReadView` from `./projections/latest.ts`, which
re-exports it. `ReadView` only grows, so `apply` and `export` are not edited. Agreed with the #59 session by message;
umbrella #44 comments 5950536272 and 5950598775.

Rejected: a one-line edit of `commit.ts` to call `rebuild` — the cleaner name, but a source path shared with #59
while both are in implementation. The name `latest(commits)` reads as "the view at the latest commit"; a rename can
ride with the next Change that edits `commit.ts` (#83).

### D-2. Files

```
src/ledger/projections/
  projection.ts  — the types: Edge, Revisions, Projection<S>
  view.ts        — the fold: rebuild, extend, serialize, PROJECTIONS, the projection `latest`, ReadView
  referrers.ts   — references of a record (REQ-PJ-002), type resolution, the projection `referrers`
  latest.ts      — the entry: `latest(commits) = rebuild(commits)`; re-exports ReadView, Edge
```

No import cycle (ST-S01): `latest → view → {projection, referrers}`, `referrers → projection`. Every file imports only
`../../kernel/index.ts`, `../records.ts` and its siblings — allowed for `ledger` by the module matrix, which is not
changed.

### D-3. The API

```ts
// projection.ts
export type Edge = { readonly from: string; readonly path: string; readonly ref: string };
/** The revisions after the commit being folded: every revision of every entity. */
export type Revisions = {
  revision(id: string, rev: number): EntityRecord | undefined;
  latest(id: string): EntityRecord | undefined;
};
export type Projection<S> = {
  readonly name: string;
  empty(): S;
  /** Pure: a new state; never changes `state`. */
  fold(state: S, commit: Commit, revisions: Revisions): S;
  /** A JSON value; object keys are sorted by `canonical`, arrays are in the order of the spec. */
  serialize(state: S): unknown;
};

// view.ts
export type ReadView = {
  readonly seq: number;
  get(id: string): EntityRecord | undefined;
  entities(): readonly EntityRecord[];
  revision(id: string, rev: number): EntityRecord | undefined;
  referrers(id: string): readonly Edge[];
};
export const PROJECTIONS: readonly Projection<unknown>[];       // [latest, referrers]
/** `list` defaults to PROJECTIONS; any list that is not a permutation of it throws (REQ-PJ-004). */
export function rebuild(commits: readonly Commit[], list?: readonly Projection<unknown>[]): ReadView;
export type Extended =
  | { readonly ok: true; readonly view: ReadView }
  | { readonly ok: false; readonly seq: number; readonly base: number };
export function extend(view: ReadView, commit: Commit): Extended;
export function serialize(view: ReadView): string;
```

The view object is frozen; its internal state (the revisions, the list and each projection's state) is held in a
module-private `WeakMap` keyed by the view, so `extend` and `serialize` reach it without widening `ReadView`. `rebuild`
is `commits.reduce` of the same fold step that `extend` runs, starting from the empty view of `list`, without the
`base` check — `openLedger` hands it commits whose chain it verified (LG-C04). `extend` checks `commit.base ===
view.seq` (REQ-PJ-003), then runs the step on copies.

### D-4. The fold step and type resolution

One step for one commit:
1. `revisions'` = `revisions` plus every entity record of the commit, in commit order (a `Map<id, EntityRecord[]>` in
   ledger order; `revision(id, rev)` is the last element with that `rev`, `latest(id)` the last element — REQ-PJ-001
   defines both by ledger order, so a ledger with gaps or repeats of `rev` (#114) still has one answer). Copy on write:
   `extend` copies the outer map and every array it appends to; `rebuild` may reuse its own map because no earlier
   view escapes.
2. For each projection of the list, in list order: `state' = fold(state, commit, revisions')`. A projection reads only
   the commit, `revisions'` and its own state — never another projection —, which is what makes the order of the list
   irrelevant (REQ-PJ-004).
3. `seq' = commit.seq`.

`referrers.fold` reads the references of every record of the commit (REQ-PJ-002), into a `Map<path, ref>` per record
— so a path that steps 2 and 3 both give (an event type that declares a role of `of` as a `ref` node, REQ-KR-017) is one
edge:
- `/type` — `parseRef(record.type)`; on success the edge with `ref = record.type`;
- for an event (a record without `rev`, `isEntityRecord` of `records.ts`) whose `body` is an object whose `of` is a
  non-array object: every role, in code-unit order, whose value is a string that parses as a reference; the role is
  escaped as a JSON Pointer token (`~` → `~0`, `/` → `~1`);
- schema references: resolve the type (below); on success `admit(canonical(body), type)`; on success each
  `{path, ref}` of `refs` → `{path: "/body" + path, ref: formatRef(ref.id, ref.version)}`.

Resolution of `T@n`: `core/type@1` → `metaType`. Otherwise `T@n` must parse as a pinned reference; the walk starts
with `revisions'.revision(T, n)` and, while the last record's `body.extends` is a string that parses as a pinned
reference and the chain has fewer than six records, appends `revisions'.revision(P, m)`; an absent record ends the walk
unresolved; then `typeOf(chain)`, which refuses a cycle (`bad-extends`: a type never extends a revision of itself) and
six records (`chain-too-long`). The bound of six makes a cycle written in one commit end the walk instead of hanging
the opening. A successful `Type` is cached in the projection state by `T@n` (revisions never change, so the cache
never goes stale); a failure is not cached, so a type written later resolves for the records folded after it. The
cache is part of the state but not of its serialization.

The index state: `bySource: Map<from, Map<path + "\u0000" + ref, Edge>>` and `byTarget: Map<targetId, Set<from>>`.
Folding an entity record removes the source `id@rev` of the revision before it (the last element of its array before
step 1 appended this one) — its edges leave `byTarget` — and adds its own edges; folding an event adds its edges to the
source of its `id`, so two events with one `id` give the union (REQ-PJ-002). `referrers(id)` collects the edges of each
source in `byTarget.get(id)` whose target is `id`, sorted by `from`, then `path`, then `ref`, in UTF-16 code units
(`byCodeUnits` of `records.ts`). Serialization walks targets in sorted order: no map is ever iterated in insertion
order into the output, and no `Promise`, timer or worker is used (REQ-PJ-004).

### D-5. Why the latest revision and every event are the sources

OM-R05 indexes references "from entities and events". The readers are navigation and expansion (LN-X01, LN-X02),
successors (OM-I07) and later the findings of OM-R04 — all about what is in use now: an old revision that named `X`
and a new one that does not should not keep `X` among its referrers. Events are immutable, so every event is a source.
History stays readable through `revision(id, rev)`; an "all revisions" index can be a projection of its own if a
reader needs one.

Rejected: every revision as a source — the edges of `X@1` stay after `X@2` drops the reference, so expansion would
follow references the block no longer makes.

This reads "all references" of OM-R05 as the references of the records in use; spec review 1 (F-18) asks the
maintainer to confirm it. The merge of the spec-PR is that confirmation; a reader that needs history gets its own
projection.

### D-6. The `/type` edge

OM-E02 makes `type` a pinned reference, and OM-R05 asks for all references, so `referrers("std/rule")` lists the blocks
of every revision of the type. Readers that want only body references filter by `path` (an edge label of LN-X02 is the
first body member of the path, `type` and `of` for the envelope). The cost is one edge per record.

### D-7. Serialized form

`serialize(view)` = `canonical({seq, <name>: projection.serialize(state), …})` of the kernel (REQ-KR-010): JCS sorts
the keys, so the order of the list cannot reach the bytes, and the text is the same on every machine (no locale, no
floating point: only integers and strings). `latest` serializes `{<id>: {hash, rev, type}}`; `referrers`
`{<target>: [{from, path, ref}, …]}`. The type cache is not serialized.

### D-8. Reference ledgers and their generator

`test/projections/reference.ts` builds the two cases in process and, run by hand (`node --experimental-strip-types
test/projections/reference.ts --write`), writes `test/fixtures/projections/<case>/ledger.jsonl` and `index.json`:
- `skeleton` — `importMd` of `test/fixtures/md/fixture.md` (REQ-CL-003), `apply` on an empty ledger, then the
  revision of `lattice/fx-a02` of SCN-CL-009, through the ledger's `apply` — the ledger the commands write;
- `typed` — commits built directly, not through `apply`: each commit object is assembled in canonical record order
  (LG-C07) with `recordHash` and `commitHash` of `src/ledger/commit.ts` (imported, not edited) and its canonical text
  written. Apply today does not admit bodies against their types; once it does (#83), it would reject `test/n5`,
  `test/n6` and the loop types, which REQ-PJ-002 still has to define (spec review 1, F-17). Commits: 1 — the types
  `test/node@1` (`uses`, `pins`, and `supersedes` as a list of pinned references, OM-I07), `test/note@1` (`of` with the
  role `subject` as a pinned `ref` node) and blocks `test/n1`, `test/n2`; 2 — the type `test/leaf@1` (`extends:
  test/node@1`) and the block `test/n3` of it; 3 — `test/n1@2` and the event `test/e0`; 4 — `test/n1@3`, the event
  `test/e1`, `test/n4` with `supersedes: ["test/n1@3"]`, `test/n5` of the unwritten `test/ghost@1`, `test/n6` with a
  member its type does not declare, the types `test/loop-a@1` / `test/loop-b@1` extending each other and `test/n7` of
  `test/loop-a@1`. Every commit holds its session event (`core/session@1`, `of: {}`), as apply would write it.

A test never runs the generator: the files are frozen and compared byte for byte (SCN-PJ-008), and SCN-PJ-009 checks the
parsed `index.json` against the facts of SCN-PJ-001…004, so what `serialize` writes is checked by meaning, not only by
its own output. The files are regenerated, with the diff of `index.json` shown in the PR, when the kernel, the commit
or record form, the opening checks (LG-C04; #83, #85, #114) or the meaning of a projection change — LG-G05: every store
before the switch is disposable. `s0-bootstrap` (#59) adds the commit field `acts` only to commits that have acts, so
these ledgers stay of the commit form whichever lands first. The test reads `ledger.jsonl` with `readFileSync`, splits
it at line feeds into `StoredLedger.commits` (`torn: null`) and calls `openLedger` — no store adapter, so a later change
of the `store` port (#86) touches one helper.

### D-9. CI on two operating systems

A new job in `.github/workflows/test.yml`, a policy path — the maintainer's patch, committed into the impl-PR branch:

```yaml
  projections-windows:
    name: projections-windows
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: node --experimental-strip-types --test "test/projections/**/*.test.ts"
```

The job `test` keeps its name and runs everything on Linux, so the required checks of `main` do not change; making
`projections-windows` required is the maintainer's choice in branch protection. Only the projection tests run on
Windows: other tests (CLI child processes, paths) were never written for it, and LG-J02 asks this of projections.
`eol=lf` keeps the fixtures byte-equal across the two checkouts.

### D-10. Tests and the scope of the implement Run

| Test file | Scenarios |
|---|---|
| `test/projections/view.test.ts` | SCN-PJ-001 |
| `test/projections/referrers.test.ts` | SCN-PJ-002, SCN-PJ-003, SCN-PJ-004 |
| `test/projections/rebuild.test.ts` | SCN-PJ-005, SCN-PJ-006, SCN-PJ-007 |
| `test/projections/reference.test.ts` | SCN-PJ-008, SCN-PJ-009 |
| `test/projections/ci.test.ts` | SCN-PJ-010 — reads `.github/workflows/test.yml` as text (no YAML parser: the job name, `runs-on: windows-latest` and the test command are matched line by line) |

Helpers: `test/projections/reference.ts` (D-8) and `test/projections/ledgers.ts` (reading a fixture folder). The facts
of SCN-PJ-002…004 live once in `ledgers.ts` as expected edges, asserted against `view.referrers` (SCN-PJ-002…004) and
against the parsed `index.json` (SCN-PJ-009).

SCN-PJ-010 checks the workflow statically; that the job really passes on Windows is shown by the green
`projections-windows` check of the impl-PR, whose log names SCN-PJ-008 (task 4.2). The job is not a required check of
`main` unless the maintainer makes it one.

`warrant run start s0-projections --operation implement --scope
"src/ledger/projections/**,test/projections/**,test/fixtures/projections/**,openspec/changes/s0-projections/**"`.

## Decisions on implementation (I-N)

| ID | Decision | Why | By |
|---|---|---|---|
| I-1 | Only `src/ledger/projections/**` and its tests; `latest(commits)` returns the full view (D-1). | #59 changes `src/ledger/commit.ts` and `src/ledger/index.ts` in parallel (SL-T08). | agreed with the session of #59; umbrella #44 comments 5950536272, 5950598775 |
| I-2 | The references of a record are one edge per path, the index a set of `{from, path, ref}`; revisions and `get` by ledger order; the `extends` walk bounded at six records; equality of views defined (with `revision`); `extend` returns `{ok: false, seq, base}`; `rebuild` takes only permutations of `PROJECTIONS`; SCN-PJ-009 checks the parsed index, SCN-PJ-010 the Windows job; `typed` built without apply (D-4, D-8, D-10). Opening checks of `rev`, `base` and event ids → #114. | Spec review 1 (`EVID-01M3Y3RN0TBXHKARD397QDD1MP`, NOT_PROVEN): F-1 (BLOCKER), F-2…F-7 (MAJOR), F-8…F-16, F-17. | approval of the spec-PR |

## Risks / Trade-offs

- **Fixtures follow the commit form** → the reference ledgers break whenever opening changes (#59, #83, #85).
  Mitigation: the generator (D-8); whichever Change lands last regenerates, announced on #44.
- **Unresolved types are silent** → before #83 apply does not admit bodies against their type, so a record may have no
  schema references without an error. Mitigation: REQ-PJ-002 states it; SCN-PJ-004 pins it; after #83 an opened ledger
  only holds admitted bodies.
- **One edge per record for `/type`** → a larger index for `std` types. Accepted (D-6).
- **Windows job not required** → a Windows-only break shows red but does not block the merge until the maintainer
  makes it required.
- **Later projections hold `PJ`** → uniqueness (#82) and trust projections change REQ-PJ-004 and the indexes; said on
  #44.

## Migration Plan

None: projections are not stored (LG-J01). Rollback is reverting the impl-PR; `get` and `entities` behave as before.
