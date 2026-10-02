# Spec Delta

## ADDED Requirements

### Requirement: The read view is rebuilt from the commits of the ledger
<!-- id: REQ-PJ-001 -->

The module `ledger` SHALL compute its projections from the commits of the ledger only (LG-J01): `rebuild(commits)`
folds the commits in ledger order into a **read view**; nothing else is stored. A commit is folded in two steps: first
every entity record of the commit is added to the revisions, in the order of the commit, then every projection of the
list (REQ-PJ-004) reads the commit — so a type and blocks of that type written in one commit (LG-C07) see each other,
whichever sorts first.

The **revisions** of an entity `id` are its entity records in ledger order. The read view SHALL give:
- `seq` — the `seq` of the last commit folded, `0` for no commit;
- `get(id)` — the last revision of `id`, or none;
- `entities()` — the last revision of every entity, ordered by `id` in UTF-16 code units;
- `revision(id, rev)` — the last revision of `id` whose `rev` is `rev`, or none;
- `referrers(id)` — the edges whose target is `id` (REQ-PJ-002).

Apply writes `rev` 1 first and then `base + 1` on the last revision (LG-P02), so in a ledger apply wrote the revisions
of an `id` are `rev` 1, 2, 3, … and `get` is the one of the highest `rev`. Opening a ledger (REQ-CL-004) checks neither
this nor the JSON types of the fields of a record (#114); the definitions above give one answer for any order of
`rev`, and the view assumes `id`, `type` and `by` are strings and `rev` an integer, as the commit form of REQ-LG-003
writes them.

Two views are **equal** when they have the same `seq`, the same `serialize` text (REQ-PJ-004), and the same answer of
`revision(id, rev)` for every `id` and `rev` of the entity records of their commits.

The view hands out the records it is given: the records of a ledger opened by `openLedger` (REQ-CL-004) are deeply
frozen (SL-T02). The lists `entities()` and `referrers(id)` return are frozen. The view of a ledger opened by
`openLedger` SHALL be the view `rebuild` gives over its commits, built in memory every time a store opens (LG-J04); no
projection is read from or written to disk. Apply and export read entities only through this view (REQ-LG-002,
REQ-CL-005).

Implements: LG-J01, LG-J04

Of LG-J01 this requirement covers latest revision and referrers; uniqueness (OM-D01), in force (TR-I01) and findings
(TR-N01) are added to the list by the Changes of their rules. A disk cache (LG-J04) is not built in S0.

#### Scenario: Latest revision and every revision of an entity
<!-- id: SCN-PJ-001 -->
- **WHEN** the reference ledger `typed` (REQ-PJ-005) is opened with `openLedger`
- **THEN** the view has `seq` 4; `get("test/n1")` is the record of `rev` 3, and `revision("test/n1", 1)`,
  `revision("test/n1", 2)` are the records of `rev` 1 and 2; `revision("test/n1", 4)`, `revision("test/absent", 1)` and
  `get("test/absent")` are none; `entities()` lists one record per entity `id` of the ledger, each its last revision,
  ordered by `id`; every record handed out, and the list `entities()` returns, are deeply frozen

#### Scenario: A repeated revision is read in ledger order
<!-- id: SCN-PJ-011 -->
- **WHEN** the reference ledger `typed` holds `test/n8` at `rev` 1 in commit 3, naming `test/n1` in `uses`, and again at
  `rev` 1 in commit 4, naming `test/n3`; the type `test/twice@1` in commit 1, declaring `uses` as a list of floating
  references to `test/node`, and again at `rev` 1 in commit 4, declaring `uses` as a list of plain strings; a block
  `test/n10` of type `test/twice@1` in commit 1 and a block `test/n9` of it in commit 4, both naming `test/n2` in `uses`
- **THEN** `get("test/n8")` and `revision("test/n8", 1)` are the record of commit 4; `referrers("test/n1")` holds no edge
  from `test/n8@1` and `referrers("test/n3")` holds `{from: "test/n8@1", path: "/body/uses/0", ref: "test/n3"}`;
  `referrers("test/n2")` holds the edge from `test/n10@1` at `/body/uses/0` and none from `test/n9@1`

### Requirement: Referrers index every reference of the records in use
<!-- id: REQ-PJ-002 -->

An **edge** is `{from, path, ref}`: `from` the source — `id@rev` of an entity revision, the `id` of an event —, `path`
the JSON Pointer (RFC 6901) of the reference in the record, `ref` the reference string. The **references of a record**
SHALL be the edges of these steps, one edge per `path` — a path that two steps give is one edge (the value at a path is
one string, so both give the same `ref`):
1. its `type` (OM-E02), at path `/type`, when the `type` is a reference (REQ-KR-012); `ref` is the `type`;
2. for an event whose `body` is an object whose `of` is an object (not an array): every role of `of`, in UTF-16 code
   unit order, whose value is a string that is a reference (OM-E04), at `/body/of/<role>` (`<role>` escaped as a JSON
   Pointer token); `ref` is the value;
3. the references its type declares (OM-R02): for every element `{path, ref}` of `refs` of the admission of its body
   under its type (REQ-KR-013, REQ-KR-015), the edge at `/body` followed by `path`, with `ref` = `formatRef(ref.id,
   ref.version)` (REQ-KR-012).

The type of a record is **resolved** from the revisions as they stand after the record's own commit is added: the type
`core/type@1` is `metaType` (REQ-KR-016); any other type `T@n` is `typeOf` (REQ-KR-014) of the **chain** that starts
with `revision(T, n)` and follows `extends`: while the last record of the chain has a body whose `extends` is a string
that is a pinned reference `P@m`, and the chain has fewer than six records, `revision(P, m)` is appended. A type does
not resolve when `T@n` is not a pinned reference, a record of the chain is none, or `typeOf` refuses the chain (a cycle,
more than five records, a record that is not a type). A type that does not resolve, and a body that `admit` refuses
under its type (its canonical form, REQ-KR-010, given as the text), give no edge of step 3; steps 1 and 2 still apply.
The references of a record are read once, when its commit is folded, against the revisions of that moment: a type
revision written later changes no edge of a record folded before it.

The index is a set of edges. Its **sources** are the last revision of every entity and every event (OM-R05: references
from entities and events): folding an entity record removes every edge whose `from` is `id@rev` of the revision of the
same `id` before it, if any, then adds the edges of the record; folding an event adds its edges. Edges equal in `from`,
`path` and `ref` are one edge, so two events with one `id` give the union of their edges.

The **target** of an edge is the `id` of its `ref`, pinned or floating (OM-R01); whether that `id` names an entity or an
event is not told apart. `referrers(id)` SHALL list the edges whose target is `id`, ordered by `from`, then `path`, then
`ref`, each in UTF-16 code units; an `id` with no edge gives an empty list. Whether a target exists is not checked here
(OM-R03). The **successors** of an entity (OM-I07) are the sources of its referrers whose `path` is
`/body/supersedes/<i>`.

Implements: OM-R05, OM-R01, OM-E02, OM-E04, OM-I07

Of OM-R05 the sources are the records in use — the last revision of every entity and every event (design D-5); the
references of earlier revisions stay readable through `revision`.

#### Scenario: Pinned and floating references from entities and events
<!-- id: SCN-PJ-002 -->
- **WHEN** the reference ledger `typed` (REQ-PJ-005) is opened — a type `test/node@1` whose schema declares `uses` (a
  list of floating references to `test/node`) and `pins` (a pinned reference to `test/node`); a type `test/sub@1`
  extending `test/node@1`, written in the same commit as the block `test/n3` of type `test/sub@1` (the block sorts before
  its type, LG-C07), naming `test/n1` in `uses`; blocks `test/n1`, `test/n2` of type `test/node@1`, `test/n1@3` naming
  `test/n2` in `uses` and `test/n2@1` in `pins`; a type `test/note@1` whose schema declares `of` with the roles `subject`
  (a pinned reference to `test/node`) and `about` (a floating reference to `test/note`), and `cites` (a floating
  reference to `test/node`); an event `test/e1` of type `test/note@1` with `of` `{subject: "test/n1@2", about:
  "test/e0"}` and `cites` `test/n2`
- **THEN** `referrers("test/n2")` holds `{from: "test/n1@3", path: "/body/pins", ref: "test/n2@1"}`, `{from:
  "test/n1@3", path: "/body/uses/0", ref: "test/n2"}` and `{from: "test/e1", path: "/body/cites", ref: "test/n2"}`, in
  the order of REQ-PJ-002; `referrers("test/n1")` holds exactly one edge from `test/e1` — `{from: "test/e1", path:
  "/body/of/subject", ref: "test/n1@2"}` — and the edge `{from: "test/n3@1", path: "/body/uses/0", ref: "test/n1"}`;
  `referrers("test/e0")` holds exactly one edge from `test/e1`, at `/body/of/about`; `referrers("test/node")` holds the
  `/type` edges of the blocks of `test/node@1` and `{from: "test/sub@1", path: "/body/extends", ref: "test/node@1"}`;
  `referrers("core/type")` holds the `/type` edge of every type record

#### Scenario: A new revision replaces the edges of the one before
<!-- id: SCN-PJ-003 -->
- **WHEN** in the reference ledger `typed` `test/n1` at `rev` 1 names `test/n2` in `uses`, at `rev` 2 names `test/n3`
  instead, and at `rev` 3 names both; and a block `test/n4` names `test/n1@3` in its `supersedes` (a list of pinned
  references declared by its type)
- **THEN** `referrers("test/n2")` and `referrers("test/n3")` hold the edges from `test/n1@3` and none from
  `test/n1@1` or `test/n1@2`; `referrers("test/n1")` holds `{from: "test/n4@1", path: "/body/supersedes/0", ref:
  "test/n1@3"}`, so `test/n4` is the successor of `test/n1`

#### Scenario: A record whose type does not resolve keeps its envelope references
<!-- id: SCN-PJ-004 -->
- **WHEN** the reference ledger `typed` holds a block `test/n5` of type `test/ghost@1`, which no commit writes, whose
  body names `test/n1` in a member `uses`; a block `test/n6` of type `test/node@1` whose body `admit` refuses (a member
  its type does not declare) and names `test/n1` in `uses`; types `test/loop-a@1` and `test/loop-b@1` extending each
  other and a block `test/n7` of type `test/loop-a@1` naming `test/n1` in `uses`; and the reference ledger `skeleton`
  is opened
- **THEN** `referrers("test/ghost")` is `{from: "test/n5@1", path: "/type", ref: "test/ghost@1"}`; no edge of
  `referrers("test/n1")` comes from `test/n5@1`, `test/n6@1` or `test/n7@1`, and `referrers("test/loop-a")` holds the
  `/type` edge of `test/n7@1`; in the view of `skeleton` — which holds no type record, so no record has a resolved type
  and the `$ref` markers of a document's `rows` are found by no schema (NX-15) — every edge is at `/type`, and
  `referrers("lattice/document")` holds the `/type` edge of the document

### Requirement: A view is extended by one commit on its tail
<!-- id: REQ-PJ-003 -->

`extend(view, commit)` SHALL return `{ok: true, view}` with a view equal (REQ-PJ-001) to the view rebuilt from the
commits of `view` followed by `commit`, when the commit's `base` (LG-C02) is the `seq` of `view` and its `seq` is
greater than its `base`; otherwise it SHALL return `{ok: false, tail, base, seq}` — the `seq` of the view, the `base`
and the `seq` of the commit. It never throws on a commit, and `view` itself stays equal to what it was. The empty view
(`rebuild` of no commit) has `seq` 0, the `base` of the first commit. `extend` and `serialize` throw on a value that is
not a view `rebuild` or `extend` returned.

The view knows the `seq` of its tail, not its hash: that a commit's `prev` is the hash of the tail is checked by the
ledger before it appends (LG-C03, REQ-LG-004), and that the chain holds when a store opens (LG-C04). So of LG-J03 the
view guarantees that the projections a check reads were folded up to the `seq` the commit was built on.

`rebuild` does not check `base`: the equality above holds for ledgers in which every commit's `base` is the `seq` of
the commit before it (`0` for the first), as apply writes them (LG-C03); opening a ledger does not check it (#114).

Implements: LG-J03, LG-J02

Of LG-J02 this requirement gives the first of its three ways: an incremental index against a rebuild from scratch.

#### Scenario: Extension refuses a commit off the tail
<!-- id: SCN-PJ-005 -->
- **WHEN** the view of the first two commits of the reference ledger `typed` is extended with its fourth commit; then
  with its third; then the view of three commits with a copy of the fourth commit whose `seq` is 3
- **THEN** the first returns `{ok: false, tail: 2, base: 3, seq: 4}`; the second returns a view of `seq` 3 in which
  `revision("test/n1", 2)` is the record of `rev` 2; the third returns `{ok: false, tail: 3, base: 3, seq: 3}`; the view
  of two commits still has `seq` 2, serializes (REQ-PJ-004) to the same text as before the calls, and its
  `revision("test/n1", 2)` is none

#### Scenario: Incremental and from scratch give equal views
<!-- id: SCN-PJ-006 -->
- **WHEN** for every reference ledger (REQ-PJ-005) and every `k` from 0 to the number of its commits, the empty view is
  extended with its first `k` commits one by one, and `rebuild` runs on the same `k` commits
- **THEN** for every `k` the two views are equal: the same `seq`, the same `serialize` text, and the same
  `revision(id, rev)` for every entity record of the ledger

### Requirement: The serialized view does not depend on the order of the projection list
<!-- id: REQ-PJ-004 -->

The projections of a view SHALL be a list `PROJECTIONS` of projections with distinct names: `latest` and `referrers`.
`rebuild(commits, list)` takes a permutation of `PROJECTIONS` (`PROJECTIONS` when omitted) and throws on any other list;
`extend` keeps the list of its view. `serialize(view)` SHALL give the canonical form (REQ-KR-010) of an object with
`seq` and one member per projection, by its name:
- `latest` — an object mapping the `id` of every entity to `{rev, type, hash}` of its last revision;
- `referrers` — an object mapping every target `id` with at least one edge to its edges in the order of REQ-PJ-002.

For every permutation of the list `rebuild` SHALL give views with the same `serialize` text. Projection code SHALL NOT
read the clock, ids, random numbers or the environment, nor depend on the order of parallel traversal (LG-J02); as code
of `ledger` it is pure (REQ-AR-010, ST-S03).

Implements: LG-J02, LG-J01

Of LG-J02 this requirement gives the second way: the list of projections permuted.

#### Scenario: Every order of the list gives the same bytes
<!-- id: SCN-PJ-007 -->
- **WHEN** for every reference ledger `rebuild` runs on its commits with every permutation of `PROJECTIONS`, and once
  with the list `[latest]`
- **THEN** every permutation serializes to the same text, which has exactly the members `latest`, `referrers` and
  `seq`; the call with `[latest]` throws

### Requirement: Reference ledgers with a verified index are kept in git
<!-- id: REQ-PJ-005 -->

The repository SHALL keep frozen reference ledgers in `test/fixtures/projections/<case>/` (LG-J02): `ledger.jsonl` — the
canonical texts of the commits, one per line, each ending with a line feed — and `index.json` — the text `serialize`
gives for the view of that ledger, followed by one line feed. The cases are at least:
- `skeleton` — the ledger the commands write for the fixture `md` (REQ-CL-006: `init`, `import-md`, `apply`) followed
  by the revision of SCN-CL-009;
- `typed` — four commits, commit `k` with `seq` `k` and `base` `k − 1`, each with its session event, holding the records
  SCN-PJ-001…SCN-PJ-004 and SCN-PJ-011 name: `test/n1` at `rev` 1 in commit 1, at `rev` 2 in commit 3 and at `rev` 3 in
  commit 4; `test/sub@1` and `test/n3` in commit 2; `test/e0` in commit 3; `test/e1` in commit 4.

For every case the ledger SHALL open (LG-C04) and the serialized view of `openLedger` SHALL equal `index.json` byte for
byte; a folder without one of the two files, or whose ledger does not open, fails naming the folder. The index is
**verified** by meaning: the facts SCN-PJ-001…SCN-PJ-004 and SCN-PJ-011 assert of the view hold of the parsed
`index.json` as well.

CI SHALL run these checks on two operating systems: Linux, in the job `test`, and Windows, in a job
`projections-windows` of `.github/workflows/test.yml` that runs the tests of `test/projections/` on `windows-latest`.

Implements: LG-J02

Of LG-J02 this requirement gives the third way — two operating systems — and the frozen reference ledgers.

#### Scenario: A reference ledger rebuilds to its index
<!-- id: SCN-PJ-008 -->
- **WHEN** every folder of `test/fixtures/projections/` is read: its `ledger.jsonl` opened with `openLedger` and its view
  serialized; and a copy of `typed` without `index.json`, in a temporary folder, is read the same way
- **THEN** every ledger opens, every serialized view followed by a line feed equals the bytes of its `index.json`, and
  the folders `skeleton` and `typed` are among them; the copy fails naming its folder

#### Scenario: The index holds what the view answers
<!-- id: SCN-PJ-009 -->
- **WHEN** `index.json` of `typed` and of `skeleton` is parsed as JSON
- **THEN** its `latest` has exactly one member per entity `id` of the ledger, and the member of `test/n1` is `{rev: 3,
  type, hash}` of the record of `rev` 3; its `referrers` holds the edges SCN-PJ-002…SCN-PJ-004 and SCN-PJ-011 assert, in
  the same order, and no member with an empty list; `seq` is the `seq` of the last commit

#### Scenario: The workflow runs the projection tests on Windows
<!-- id: SCN-PJ-010 -->
- **WHEN** `.github/workflows/test.yml` is read
- **THEN** it has the job `test` and a job `projections-windows` whose `runs-on` is `windows-latest` and whose last step
  runs `node --experimental-strip-types --test` on `test/projections/**/*.test.ts`
