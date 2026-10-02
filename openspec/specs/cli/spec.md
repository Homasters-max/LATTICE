# cli Specification

## Purpose
The `lattice` command: its command table and the store commands through which a project store is created, a proposal
is written from `md`, applied to the `knowledge` ledger and exported back to `md`.

## Requirements

### Requirement: The command table
<!-- id: REQ-CL-001 -->

`lattice <command> [arguments]` SHALL run the command named by its first argument from a closed table. The commands of
the table are `init`, `import-md`, `apply` and `export`. Every command works on the project root, which is the current
directory, and on the paths of LG-S05 under it: the init configuration `store/lattice.json`, the `knowledge` ledger
`store/knowledge.jsonl` and the proposals folder `store/proposals/`.

Without a command, or with a command not in the table, `lattice` SHALL write a usage text to standard error naming
every command of the table with a one-line summary, write no file and exit with code 2. An unknown option, a missing
option value or a wrong number of arguments of a command is a usage error with code 2.

Every command SHALL exit with one of these codes: `0` — done; `1` — the proposal was rejected, each rejection naming
its rule — by reading it, by apply or by the check of the tail (`apply`, REQ-LG-002) —, or the input was refused by the
codec (`import-md`), and nothing was written; `2` — a usage error or a refusal of the environment: a missing or an
existing store, an invalid init configuration, a refused `std` package (REQ-CL-002), a broken ledger (REQ-CL-004,
**Opening**) or a store outside the genesis chain (REQ-CL-004, **Opening a store**), a store that answers that the tail
moved while it has not (REQ-CL-004), a refused export (REQ-CL-005), an unreadable or unwritable file. A refusal with
code 2 is decided before anything is written, except a failure of the file system during a write, or a store that
answers `moved` to an append of `init` (another writer in the new store, REQ-CL-002): the JSONL store locks, `fsync`s
and recovers each append (REQ-SR-001…003), but a write of the command's own files and the four appends of `init` are
not one transaction, so after such a failure the store may hold a partial write, and the message names the file or
the store. Messages
of codes 1 and 2 go to standard error, except the rejections of `apply` (REQ-CL-004). A path a command prints is
relative to the project root when it lies under it, otherwise absolute; its separator is `/`.

Implements: PL-E02, LG-S05

#### Scenario: An unknown command prints the usage
<!-- id: SCN-CL-001 -->
- **WHEN** `lattice` runs without arguments, then with the argument `frobnicate`, then as `lattice export` without
  `--out`, in an empty folder
- **THEN** each run exits with code 2; the standard error of the first two names `init`, `import-md`, `apply` and
  `export`; the folder stays empty

### Requirement: init creates a project store with its first four commits
<!-- id: REQ-CL-002 -->

`lattice init --namespace <namespace> --owner <login>` SHALL create the folder `store/` with the init configuration
`store/lattice.json` — the canonical JSON (RFC 8785) of `{"namespace": <namespace>, "owner": <login>}` followed by one
line feed —, an empty folder `store/proposals/`, and the ledger `store/knowledge.jsonl` holding the four commits of
store init (LG-G04, REQ-LG-008), the last three applied with the acts of the `init` adapter of the `acts` port for
`<login>` (REQ-AC-002). The `std` package is the file `std/std.json` of the LATTICE installation (REQ-LG-007); the
sessions of commits 2–4 take one `at` from the clock (formatted by the kernel, OM-E03), and the four ULIDs `u1`…`u4`
of REQ-LG-008 come from the `ids` port in that order.

`init` SHALL first build the four commits in memory — each proposal applied through apply on the ledger the commits
before it make, opened as REQ-CL-004 **Opening** opens a ledger —, and only then create `store/` — a creation that
fails when `store/` exists by then, so a second `init` running at the same time is refused with code 2 and never
writes into the first one's store —, write the configuration, create `store/proposals/` and an empty ledger, and
append the four commit texts in order through the `store` port, each after the `seq` of the one before. Only after all four appends succeeded SHALL it print one line
`{"outcome":"commit","seq":<seq>}` per commit, in order, and exit with code 0. `init` writes no proposal file.

It SHALL refuse with code 2, writing nothing, when `store/` already exists; when an option is missing; when the
namespace does not match `[a-z][a-z0-9-]*` (OM-I05), is longer than 64 characters, or is `core` or `std` (reserved,
CT-N02); when the login does not match `[A-Za-z0-9-]+`; when the `std` package cannot be read or is refused, the
message naming `LG-G02`; or when apply answers a proposal of store init with anything but `commit` — a defect of
LATTICE —, the message naming the commit. A store that answers `moved` to one of the appends — another writer in the
new store — is refused with code 2 naming the store; the store may then hold a partial write (REQ-CL-001), which every
later command refuses naming `LG-G04` (REQ-CL-004): the way out is to remove `store/` and run `lattice init` again.

Every other command reads `store/lattice.json` first; a missing `store/` or a configuration that is not exactly the
form above is refused with code 2.

Implements: CT-N05, LG-S05, LG-G04, LG-A04

#### Scenario: A store is created once
<!-- id: SCN-CL-002 -->
- **WHEN** `lattice init --namespace lattice --owner Homasters-max` runs in an empty folder with the clock fixed at 0 and
  the counter ids (ST-T02), then the same command runs again, then `lattice init --namespace Lattice --owner
  Homasters-max` and `lattice init --namespace std --owner Homasters-max` run in other empty folders
- **THEN** the first run exits with code 0, prints `{"outcome":"commit","seq":1}` … `{"outcome":"commit","seq":4}`, and
  leaves `store/lattice.json` equal to `{"namespace":"lattice","owner":"Homasters-max"}` and a line feed, an empty
  `store/proposals/` and a `store/knowledge.jsonl` of four lines, the commit texts of SCN-LG-011; the second run exits
  with code 2 and leaves the store byte for byte as it was; the last two exit with code 2 and create no `store/`

#### Scenario: A refused std package creates nothing
<!-- id: SCN-CL-015 -->
- **WHEN** `lattice init --namespace lattice --owner Homasters-max` runs in an empty folder with a `std` package text
  whose one schema character is changed
- **THEN** it exits with code 2, its standard error names `LG-G02`, and no `store/` exists

#### Scenario: A store that moves during init is refused
<!-- id: SCN-CL-017 -->
- **WHEN** `lattice init --namespace lattice --owner Homasters-max` runs in an empty folder against a store that
  answers `moved` to the third append
- **THEN** it exits with code 2, its standard error names the store, it prints no commit line, and the store's ledger
  holds the first two commits and nothing of its own after them; `lattice apply` on that store, run on the proposal
  file a fresh `lattice import-md` of the fixture wrote, then exits with code 2 naming `LG-G04` and `seq` 3

### Requirement: import-md writes a proposal from a table with IDs
<!-- id: REQ-CL-003 -->

`lattice import-md <file>` SHALL read an `md` file and, if it is in the skeleton form of the codec, write one proposal
file into `store/proposals/` (REQ-CL-004, **Proposal**), named `<proposal hash>.json`, print its path and exit with code
0. It writes nothing into the ledger. When a file of that name already exists the command refuses with code 2.

The skeleton form is checked step by step in this order, each step over the whole file before the next; the first
deviation is refused with code 1, its standard error naming the line (line 0 for the file name and the encoding), and
nothing is written:
1. the file name is `<stem>.md` with `<stem>` matching `[A-Za-z0-9][A-Za-z0-9._-]*`, and `<stem>` in lower case
   matches `[a-z0-9][a-z0-9.-]*`, has at most 128 characters and is neither `namespace` nor `setup` — the local parts
   of the entities store init writes (REQ-LG-008), which the document entity would collide with;
2. the bytes are valid UTF-8 without a byte order mark; lines end with a line feed, the last line too, and no line
   holds a carriage return;
3. the first line is the header; the second line is the separator; then at least one row; nothing else (a file of two
   lines is refused at line 3);
4. every line is written exactly as `| ` + its cells joined by ` | ` + ` |`; no cell holds `|`, and no cell starts or
   ends with a space;
5. the header has at least two cells; its first cell is `ID`; the other cells are non-empty, distinct, none of them is
   `ID` or starts with `$`, each gives a non-empty slug (below), the slugs are distinct, and `table.<slugs>` has at most
   128 characters; the separator has one cell `---` per header cell; every row has as many cells as the header;
6. the first cell of a row is an ID matching `[A-Z][A-Z0-9]*-[A-Z0-9]+` of at most 128 characters; IDs are unique in
   the file, and no ID in lower case equals `<stem>` in lower case (refused at the line of that row);
7. every cell is in NFC — a cell whose NFC form differs is refused, never repaired (OM-H02) — and holds only code
   points the kernel admits (REQ-KR-002: assigned code points of Unicode 16.0).

The proposal holds these intents; every intent's `by` is the `id` of the session event:
- the session event: type `core/session@1`; `id` `<namespace>/<ULID>` with a new ULID; `at` from the clock in the form
  `YYYY-MM-DDTHH:MM:SS.mmmZ` (UTC); body `{"of": {}, "participant": "lattice", "kind": "machine", "purpose":
  "import"}` (OM-E04, CT-P01, TR-B02);
- one entity intent per row: `id` `<namespace>/<ID in lower case>` (LG-B06); type `<namespace>/table.<slugs>@1`, where
  `<slugs>` are the slugs of the header cells after `ID` joined by `.` — one type per distinct header; `base` `0`; body
  an object with one field per header cell after `ID`, named by the cell and holding the row's cell text;
- the document entity intent: `id` `<namespace>/<stem in lower case>`; type `<namespace>/document@1`; `base` `0`; body
  `{"file": "<file name>", "columns": [<header cells>], "rows": [{"$ref": "<row id>"}, …]}` — one floating reference
  per row, in the order of the rows (OM-C01, OM-R02).

The slug of a header cell is the cell in lower case with every run of characters outside `[a-z0-9]` replaced by `-` and
leading and trailing `-` removed (`Rule` → `rule`). `<namespace>` is the namespace of `store/lattice.json`.

The proposal file is the canonical JSON (RFC 8785) of `{"intents": [...]}` followed by one line feed, its intents in
canonical order (LG-C07): entity intents by `id`, then event intents by `id`, both by UTF-16 code units.

Implements: LG-B05, LG-B06, LG-B07, LG-P01, LG-B03

#### Scenario: The fixture table becomes a proposal
<!-- id: SCN-CL-003 -->
- **WHEN** `lattice import-md` runs on the fixture `fixture.md` — a header `| ID | Rule |` and three rows `FX-A01`,
  `FX-A02`, `FX-A03` — in a store of namespace `lattice`
- **THEN** it exits with code 0 and prints `store/proposals/<hash>.json`, the only file of `store/proposals/`; the
  ledger is byte for byte the ledger `init` wrote; the proposal holds five intents: the session event with the purpose
  `import`; the entities `lattice/fx-a01`, `lattice/fx-a02`, `lattice/fx-a03` of type `lattice/table.rule@1` with
  `base` 0 and bodies `{"Rule": "<text>"}`; and the entity `lattice/fixture` of type `lattice/document@1` whose body
  references the three rows in table order

#### Scenario: Input outside the skeleton form is refused
<!-- id: SCN-CL-004 -->
- **WHEN** `lattice import-md` runs, in an initialised store, on a copy of the fixture whose third line is
  `|FX-A01|text|`; on one with a paragraph after the table; on one with two rows of the ID `FX-A01`; on one whose last
  line has no line feed; on one with a header `| ID | Rule | Rule |`; on one with a header and separator but no row; on
  a file `fx-a01.md` holding a row `FX-A01` on line 3; on one with a header `| ID | Rule | rule |`; on copies of the
  fixture named `Setup.md` and `namespace.md`; then on the fixture file in a folder without a store
- **THEN** every run but the last exits with code 1, its standard error naming the line of the deviation (line 3 for
  the table without a row and for `fx-a01.md`, line 1 for the two headers, line 0 for `Setup.md` and `namespace.md`),
  and `store/proposals/` stays empty; the last run exits with code 2 and creates nothing

### Requirement: apply turns a proposal into a commit, a no-op or rejections
<!-- id: REQ-CL-004 -->

`lattice apply <proposal file>` SHALL accept only a file directly in `store/proposals/` (another path is a usage error,
code 2), open the ledger, read the proposal file (REQ-LG-001) and apply it (REQ-LG-003) without acts — no adapter of
the `acts` port is wired into the command in S0 —, and act on the outcome as below. The proposal file is the one the
command removes on success (LG-P04).

**Opening (LG-C04).** Every line of `store/knowledge.jsonl` is the canonical JSON (RFC 8785) of one commit object
followed by a line feed; a commit is of the commit form of REQ-LG-003; the `seq` of the first commit is at least 1 and
every next `seq` is greater than the one before it; `prev` of the first commit is `null` and `prev` of every other
commit is the commit hash (REQ-LG-003) of the commit before it. A ledger that breaks any of this SHALL be refused with
code 2, the message naming `LG-C04` and the `seq` of the first broken commit (or its line, when it has no readable
`seq`), and nothing is written.

**Opening a store (LG-G01, LG-G04, REQ-LG-010).** After Opening, the ledger SHALL be checked against the genesis chain
and the four commits of store init for the namespace of `store/lattice.json` (REQ-LG-010): a store that fails is
refused with code 2, the message naming the rule (`LG-G01`, `LG-G02`, `LG-G03` or `LG-G04`) and the `seq`, and nothing
is written. Every command that reads the ledger of a project store — `apply` and `export` (REQ-CL-005, which opens it
as `apply` does) — runs Opening and then Opening a store. Opening alone, without this step, is what a rule fixture's
ledger must pass (REQ-AR-011) and what `init` uses on the commits it builds in memory (REQ-CL-002).

**Proposal.** A proposal file holds a proposal of the form of REQ-LG-001; the rejections of reading it are those of
REQ-LG-001.

**Outcomes.**
- `rejected` — the rejections of reading the proposal (REQ-LG-001), of apply (REQ-LG-002) or of the check of the tail
  (REQ-LG-004): `apply` SHALL print the JSON list of all rejections on standard output, in the order of REQ-LG-002;
  keep the proposal file; write nothing; and exit with code 1.
- `commit` — `apply` SHALL append one line holding the commit text after the `seq` of the commit's `base`; it sees a
  moved tail only through the store's answer `moved` (REQ-LG-004). When the store answers that the tail moved, it SHALL
  open the ledger again — refusing with code 2 if it is broken — and check the commit against it (REQ-LG-004):
  `existing` is the outcome `existing` below; the rejection `LG-C03` is the outcome `rejected` above; when the check
  gives neither, the store answered `moved` on an unmoved tail and the command refuses with code 2 naming the store.
  After the append it SHALL remove the proposal file, print `{"outcome":"commit","seq":<seq>}` and exit with code 0; if
  the removal fails, the commit stays, and the command exits with code 2 naming the proposal file left behind.
- `existing` (LG-C08) — `apply` SHALL write nothing to the ledger, remove the proposal file, print
  `{"outcome":"commit","seq":<seq of that commit>}` and exit with code 0, so a run interrupted between the append and
  the removal ends as it would have (within the limit REQ-LG-003 states).
- `no-op` (LG-C05) — `apply` SHALL write nothing to the ledger, remove the proposal file, print `{"outcome":"no-op"}`
  and exit with code 0.

A proposal file that is already gone when the command removes it counts as removed — another writer of the same
proposal removed it. Any other failed removal after `existing` or `no-op` is refused with code 2 naming the proposal
file.

Implements: LG-A01, LG-A02, LG-C03, LG-C04, LG-C05, LG-C08, LG-P04, LG-J03, LG-G01, LG-G04

#### Scenario: The fixture proposal becomes the first commit
<!-- id: SCN-CL-005 -->
- **WHEN** `lattice apply` runs on the proposal written by SCN-CL-003 on the ledger `init` wrote
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":5}`; the ledger holds the four init commits
  unchanged and a fifth line: a commit with `seq` 5, `prev` the commit hash of commit 4, `base` 4, `kernel` `"0"`, the
  proposal hash, `by` and `at` of the session, no key `acts`, and five records — `lattice/fixture`, `lattice/fx-a01`,
  `lattice/fx-a02`, `lattice/fx-a03` at `rev` 1, then the session event; the proposal file is gone

#### Scenario: A second import of the same table is rejected by LG-P02
<!-- id: SCN-CL-006 -->
- **WHEN** after SCN-CL-005 `lattice import-md` runs again on the same fixture file and `lattice apply` runs on its
  proposal
- **THEN** `apply` exits with code 1 and prints four rejections, one per entity intent, each with `rule` `LG-P02`, path
  `/intents/<i>/base`, `expected` 1 and `got` 0; the ledger is byte for byte as before and the proposal file stays

#### Scenario: A malformed proposal is rejected by LG-P01 and LG-C07
<!-- id: SCN-CL-007 -->
- **WHEN** `lattice apply` runs on the fixture proposal with its session event removed; then with the `by` key removed
  from the intent at position 1; then with the `by` of the intent at position 1 set to another session `id`; then with
  the intent at position 1 duplicated at the end of the list
- **THEN** each run exits with code 1 and the ledger is unchanged; the first prints exactly one rejection `LG-P01` with
  `intent` `null`, `path` `/intents`, `expected` 1 and `got` 0; the second exactly one `LG-P01` with that intent's `id`
  and `path` `/intents/1/by`; the third exactly one `LG-P01` with `path` `/intents/1/by`, the session `id` as `expected`
  and the other `id` as `got`; the fourth exactly one `LG-C07` with `path` `/intents/5/id`, `with` that intent's `id`
  and `differs` `[]`

#### Scenario: A tail that moved during apply is refused
<!-- id: SCN-CL-011 -->
- **WHEN** `apply` runs on the fixture proposal against a store whose ledger, holding the four init commits, gains a
  commit of another proposal between opening and appending, so the store answers that the tail moved
- **THEN** it exits with code 1 and prints exactly one rejection `LG-C03` with `intent` `null`, `path` `""`, `expected`
  `{"seq": 4, "hash": <the commit hash of commit 4>}` and `got` the `seq` 5 and the hash of the other writer's commit;
  it appends nothing — the ledger holds the init commits and the other writer's commit — and the proposal file stays

#### Scenario: A broken hash chain is refused
<!-- id: SCN-CL-008 -->
- **WHEN** a ledger of the four init commits and two more commits has one letter of a row text in commit 5 changed,
  keeping each line canonical JSON, and `lattice apply` runs on a proposal in `store/proposals/`
- **THEN** it exits with code 2, its message names `LG-C04` and `seq` 6, and the ledger and the proposal are unchanged

#### Scenario: A store outside the genesis chain is refused
<!-- id: SCN-CL-016 -->
- **WHEN** after SCN-CL-003 the ledger of the store is replaced by L1 (REQ-LG-003) — the commit of the fixture proposal
  on an empty ledger — and `lattice apply` runs on the proposal file of SCN-CL-003 in `store/proposals/`, then
  `lattice export --out out` runs; then the same with the ledger emptied, as `init` left it before this Change
- **THEN** each of the first two exits with code 2, its message naming `LG-G01` and `seq` 1; each of the last two with
  code 2 naming `LG-G04` and `seq` 1; the ledger and the proposal are unchanged and no `out/` is created

#### Scenario: An unchanged proposal is a no-op
<!-- id: SCN-CL-012 -->
- **WHEN** after SCN-CL-005 `lattice apply` runs on a proposal file in `store/proposals/` holding a new session event
  and the four entity intents of the fifth commit, each with `base` 1, `by` the new session's `id` and its type and
  body unchanged
- **THEN** it exits with code 0 and prints `{"outcome":"no-op"}`; the ledger is byte for byte as before; the proposal
  file is gone

#### Scenario: A proposal applied again answers its commit
<!-- id: SCN-CL-013 -->
- **WHEN** after SCN-CL-005 the proposal file of SCN-CL-003 is written back into `store/proposals/` with the same
  bytes and `lattice apply` runs on it
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":5}`; the ledger is byte for byte as before; the
  proposal file is gone

#### Scenario: Two writers of one proposal both answer its commit
<!-- id: SCN-CL-014 -->
- **WHEN** `apply` runs on the fixture proposal of SCN-CL-003 against a store holding the four init commits in which,
  between opening and appending, another writer appends the commit of the same proposal and removes the proposal file
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":5}`; the ledger holds the init commits and the
  other writer's commit; the proposal file is gone

### Requirement: export renders md from the latest revisions
<!-- id: REQ-CL-005 -->

`lattice export --out <folder>` SHALL open the ledger as `apply` does (REQ-CL-004; a broken ledger is refused with code
2), build the latest-revision projection (LG-J01) and read entities only through it. The documents are the entities in
it of type `<namespace>/document@1` (the namespace of `store/lattice.json`). For every document it SHALL render the
file named by the `file` of its body, in the skeleton form of REQ-CL-003: the header `ID` and the `columns` of the
body; the separator; then, for every reference of `rows` in its order, the row of the latest revision of the referenced
entity (a floating reference resolves to the latest revision, OM-R01): the local part of its `id` in upper case, then
the value of each column's field of its body.

Before writing anything, export SHALL refuse with code 2, naming the document, when:
- a document body is not an object with exactly the keys `file`, `columns` and `rows`;
- `file` is not a string `<stem>.md` as REQ-CL-003 step 1 requires, or two documents name the same `file` compared in
  lower case;
- `columns` is not a non-empty list of strings that satisfies step 5 of REQ-CL-003 for the header cells after `ID`;
- `rows` is not a non-empty list of objects with exactly the key `$ref` holding a floating reference (no `@n`);
- a reference names no entity in the projection, or an `id` whose local part in upper case is not an ID of step 6 of
  REQ-CL-003, or two references render the same ID;
- a referenced body is not an object with a string field for every column, or a cell to write holds `|`, a line feed or
  a carriage return, or starts or ends with a space. Otherwise it creates the folder when missing, writes every file into it (an existing
file is overwritten), prints the written paths one per line in the order of the `file` names (UTF-16 code units), and
exits with code 0.

Implements: LG-J01, LG-B05, OM-R01

#### Scenario: Export follows the latest revision of a row
<!-- id: SCN-CL-009 -->
- **WHEN** after SCN-CL-005 a proposal holding a session event and one entity intent for `lattice/fx-a02` — `base` 1,
  type `lattice/table.rule@1`, a changed text — is applied, and `lattice export --out out` runs
- **THEN** export exits with code 0 and prints `out/fixture.md`, and `out/fixture.md` equals the fixture file except
  the text of the row `FX-A02`, which is the changed text

### Requirement: The fixture md makes a byte-identical round trip
<!-- id: REQ-CL-006 -->

For the synthetic fixture `md` (one table with IDs), `lattice init --namespace lattice --owner Homasters-max`,
`lattice import-md <fixture>`, `lattice apply <proposal>` and `lattice export --out <folder>` run in that order on an
empty folder SHALL each exit with code 0, and the exported file SHALL be byte-identical to the fixture. A test SHALL run
this path through the `lattice` entry as a child process, so CI checks it on every pull request.

Implements: SL-T09, LG-B05

#### Scenario: The round trip gives the same bytes
<!-- id: SCN-CL-010 -->
- **WHEN** the four commands run in order through the `lattice` entry in an empty temporary folder on the fixture `md`
- **THEN** every command exits with code 0 and the exported file is byte-identical to the fixture
