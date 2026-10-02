# Spec Delta

## ADDED Requirements

### Requirement: The read view is rebuilt from the commits of the ledger
<!-- id: REQ-PJ-001 -->

The module `ledger` SHALL compute its projections from the commits of the ledger only (LG-J01): `rebuild(commits)`
folds the commits in ledger order into a **read view**; nothing else is stored, and dropping a view and rebuilding it
from the same commits gives an equal view (REQ-PJ-004). A commit is folded in two steps: first every entity record of
the commit is added to the revisions, then every projection of the list (REQ-PJ-004) reads the commit — so a type and
blocks of that type written in one commit (LG-C07) see each other.

The read view SHALL give:
- `seq` — the `seq` of the last commit folded, `0` for no commit;
- `get(id)` — the latest revision of the entity `id`: the entity record of the highest `rev` written for it, or none;
- `entities()` — the latest revision of every entity, ordered by `id` in UTF-16 code units;
- `revision(id, rev)` — the entity record of `id` with that `rev`, or none;
- `referrers(id)` — the edges whose target is `id` (REQ-PJ-002).

Records handed out by the view are the frozen records of the commits (SL-T02). The view of a ledger opened by
`openLedger` (REQ-CL-004) SHALL be the view `rebuild` gives over its commits, built in memory every time a store opens
(LG-J04); no projection is read from or written to disk. Apply and export read entities only through this view (REQ-LG-002,
REQ-CL-005), which is built on the tail they check (LG-J03).

Implements: LG-J01, LG-J04, LG-J03

Of LG-J01 this requirement covers latest revision and referrers; uniqueness (OM-D01), in force (TR-I01) and findings
(TR-N01) are added to the list by the Changes of their rules. A disk cache (LG-J04) is not built in S0.

#### Scenario: Latest revision and every revision of an entity
<!-- id: SCN-PJ-001 -->
- **WHEN** the reference ledger `typed` (REQ-PJ-005) is opened with `openLedger`
- **THEN** the view has `seq` equal to the `seq` of the last commit; `get("test/n1")` is the record of `rev` 3 and
  `revision("test/n1", 1)`, `revision("test/n1", 2)` are the records of `rev` 1 and 2; `revision("test/n1", 4)`,
  `revision("test/absent", 1)` and `get("test/absent")` are none; `entities()` lists one record per entity `id` of the
  ledger, each at its highest `rev`, ordered by `id`; every record handed out is deeply frozen

### Requirement: Referrers index every reference of the records in use
<!-- id: REQ-PJ-002 -->

The **references of a record** SHALL be, each as an edge `{from, path, ref}` — `from` the source (`id@rev` of an entity
revision, the `id` of an event), `path` the JSON Pointer of the reference in the record, `ref` the reference string
(`formatRef`, REQ-KR-012):
1. its `type` (OM-E02), at path `/type`, when the `type` is a reference (REQ-KR-012);
2. for an event, every value of `body.of` (OM-E04) that is a reference, at `/body/of/<role>`;
3. the references its type declares (OM-R02): every element of `refs` of the admission of its body under its type
   (REQ-KR-013, REQ-KR-015), at `/body` followed by the element's `path`.

The type of a record is **resolved** from the view as it stands after the record's own commit is added to the
revisions: the type `core/type@1` is `metaType`; any other type `T@n` is `typeOf` (REQ-KR-014) of the chain that starts
with `revision(T, n)` and follows each record's `extends` through `revision`. A type that does not resolve — a record
of the chain is absent or `typeOf` refuses — and a body that `admit` refuses under its type (its canonical form, REQ-KR-010,
given as the text) give no references of step 3; steps 1 and 2 still apply. The references of a record are read once,
when its commit is folded.

The **sources** of the index are the latest revision of every entity and every event (OM-R05: references from entities
and events): a new revision of an entity replaces the edges of its previous revision. The **target** of an edge is the
`id` of its reference, pinned or floating (OM-R01). `referrers(id)` SHALL list the edges whose target is `id`, ordered by
`from`, then by `path`, both in UTF-16 code units; an `id` with no edge gives an empty list. Whether a target exists is
not checked here (OM-R03). The successors of an entity (OM-I07) are the sources of the edges of its referrers at a
`supersedes` path.

Implements: OM-R05, OM-R01, OM-E02, OM-E04, OM-I07

#### Scenario: Pinned and floating references from entities and events
<!-- id: SCN-PJ-002 -->
- **WHEN** the reference ledger `typed` (REQ-PJ-005) is opened — a type `test/node@1` whose schema declares `uses` (a
  list of floating references to `test/node`) and `pins` (a pinned reference to `test/node`), and a type `test/leaf@1`
  extending `test/node@1`, written in the same commit as a block of type `test/leaf@1`; blocks `test/n1`, `test/n2`,
  `test/n3` of these types referring to each other; an event `test/e1` of type `test/note@1` whose `of` has the roles
  `subject` → `test/n1@2` and `about` → `test/e0`
- **THEN** `referrers("test/n2")` lists exactly, in this order, the edges from the latest revisions of the blocks that
  name `test/n2` in `uses` (floating, path `/body/uses/<i>`) or in `pins` (pinned, `/body/pins`); `referrers("test/n1")`
  holds the edge `{from: "test/e1", path: "/body/of/subject", ref: "test/n1@2"}`; `referrers("test/e0")` is the edge at
  `/body/of/about`; `referrers("test/node")` holds `/type` edges from the blocks of `test/node@1` and the edge at
  `/body/extends` from `test/leaf@1`; `referrers("core/type")` holds the `/type` edge of every type record; the block
  of type `test/leaf@1` written with its type has the references its type declares

#### Scenario: A new revision replaces the edges of the one before
<!-- id: SCN-PJ-003 -->
- **WHEN** in the reference ledger `typed` `test/n1` at `rev` 1 names `test/n2` in `uses`, at `rev` 2 names `test/n3`
  instead, and at `rev` 3 names both; and a block `test/n4` names `test/n1@3` in its `supersedes` (a list of pinned
  references declared by its type)
- **THEN** `referrers("test/n2")` and `referrers("test/n3")` hold the edges from `test/n1@3` and none from
  `test/n1@1` or `test/n1@2`; `referrers("test/n1")` holds `{from: "test/n4@1", path: "/body/supersedes/0", ref:
  "test/n1@3"}` — the successor of `test/n1`

#### Scenario: A record whose type does not resolve keeps its envelope references
<!-- id: SCN-PJ-004 -->
- **WHEN** the reference ledger `typed` holds a block `test/n5` of type `test/ghost@1`, which no commit writes, whose
  body names `test/n1` in a member `uses`; and a block `test/n6` of type `test/node@1` whose body `admit` refuses
  (a member its type does not declare) and names `test/n1` in `uses`; and the reference ledger `skeleton` is opened
- **THEN** `referrers("test/ghost")` is `{from: "test/n5@1", path: "/type", ref: "test/ghost@1"}`; no edge of
  `referrers("test/n1")` comes from `test/n5@1` or `test/n6@1`; in the view of `skeleton` the referrers of each row
  `id` are empty (a `$ref` marker is not a reference, NX-15) and `referrers("lattice/document")` holds the `/type` edge
  of the document

### Requirement: A view is extended by one commit on its tail
<!-- id: REQ-PJ-003 -->

`extend(view, commit)` SHALL give a new read view equal to the view rebuilt from the commits of `view` followed by
`commit`, when the commit's `base` (LG-C02) is the `seq` of the view; otherwise it SHALL refuse, naming the `seq` of the
view and the `base` of the commit (LG-J03: a view that does not match the tail is never read as if it did). `view`
itself does not change. An empty view (`rebuild` of no commit) has `seq` 0, the `base` of the first commit.

Implements: LG-J03, LG-J02

Of LG-J02 this requirement gives the first of its three ways: an incremental index against a rebuild from scratch.

#### Scenario: Extension refuses a commit off the tail
<!-- id: SCN-PJ-005 -->
- **WHEN** the view of the first two commits of the reference ledger `typed` is extended with its fourth commit, and
  then with its third
- **THEN** the first is refused naming `seq` 2 and the `base` of the fourth commit; the second gives a view of `seq` 3;
  the view of two commits still has `seq` 2 and serializes (REQ-PJ-004) as before both calls

#### Scenario: Incremental and from scratch give the same bytes
<!-- id: SCN-PJ-006 -->
- **WHEN** for every reference ledger (REQ-PJ-005) and every `k` from 0 to the number of its commits, the empty view is
  extended with its first `k` commits one by one, and `rebuild` runs on the same `k` commits
- **THEN** both views serialize to the same text for every `k`

### Requirement: The serialized view does not depend on the order of the projection list
<!-- id: REQ-PJ-004 -->

The projections of a view SHALL be a list, each with a name: `latest` and `referrers`. `rebuild(commits, list)` takes
the list (the full list by default), and `extend` keeps the list of its view. `serialize(view)` SHALL give the canonical
form (REQ-KR-010) of an object with `seq` and one member per projection of the list, by its name:
- `latest` — an object mapping every entity `id` to `{rev, type, hash}` of its latest revision;
- `referrers` — an object mapping every target `id` with at least one edge to its edges in the order of REQ-PJ-002.

A projection reads only the commit it folds, the revisions and its own state, never another projection, so for every
permutation of the list `rebuild` gives the same text from `serialize`. Projection code SHALL NOT read the clock, ids,
random numbers or the environment, nor depend on the order of parallel traversal (LG-J02, ST-S03); it iterates maps
only in an order it sorts.

Implements: LG-J02, LG-J01

Of LG-J02 this requirement gives the second way: the list of projections permuted.

#### Scenario: Every order of the list gives the same bytes
<!-- id: SCN-PJ-007 -->
- **WHEN** for every reference ledger `rebuild` runs on its commits with every permutation of the projection list
- **THEN** every result serializes to the same text, and that text has exactly the members `latest`, `referrers` and
  `seq`

### Requirement: Reference ledgers with a verified index are kept in git
<!-- id: REQ-PJ-005 -->

The repository SHALL keep frozen reference ledgers in `test/fixtures/projections/<case>/` (LG-J02): `ledger.jsonl` — the
canonical texts of the commits, one per line, each ending with a line feed — and `index.json` — the text `serialize`
gives for the view of that ledger, followed by one line feed. The cases are at least:
- `skeleton` — the ledger the commands write for the fixture `md` (REQ-CL-006: `init`, `import-md`, `apply`) followed
  by the revision of SCN-CL-009;
- `typed` — types under the meta-type with reference fields, an `extends` chain, a type and a block of it in one
  commit, revisions that change references, events with `of`, `supersedes`, and the records of SCN-PJ-004.

The index is **verified** by meaning: SCN-PJ-001…SCN-PJ-004 assert it on these ledgers. The files change only in a pull
request whose diff shows them — when the kernel or the meaning of a projection changes (LG-G05: before the switch every
store is disposable).

For every case the ledger SHALL open (LG-C04) and the serialized view of `openLedger` SHALL equal `index.json` byte for
byte. CI SHALL run this check on two operating systems: Linux, in the job `test`, and Windows, in a job
`projections-windows` that runs the tests of `test/projections/`.

Implements: LG-J02

Of LG-J02 this requirement gives the third way — two operating systems — and the frozen reference ledgers.

#### Scenario: A reference ledger rebuilds to its index
<!-- id: SCN-PJ-008 -->
- **WHEN** every folder of `test/fixtures/projections/` is read: its `ledger.jsonl` opened with `openLedger` and its view
  serialized
- **THEN** every ledger opens, every serialized view followed by a line feed equals the bytes of its `index.json`, the
  folders `skeleton` and `typed` are among them; and the same test passes in the jobs `test` (Linux) and
  `projections-windows` (Windows) of the pull request
