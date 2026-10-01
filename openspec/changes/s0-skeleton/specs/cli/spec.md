# Spec Delta

## Purpose

The `lattice` command: its command table and the store commands through which a project store is created, a proposal
is written from `md`, applied to the `knowledge` ledger and exported back to `md`.

## ADDED Requirements

### Requirement: The command table
<!-- id: REQ-CL-001 -->

`lattice <command> [arguments]` SHALL run the command named by its first argument from a closed table. The commands of
the table are `init`, `import-md`, `apply` and `export`. Every command works on the project root, which is the current
directory, and on the paths of LG-S05 under it: the init configuration `store/lattice.json`, the `knowledge` ledger
`store/knowledge.jsonl` and the proposals folder `store/proposals/`.

Without a command, or with a command not in the table, `lattice` SHALL write a usage text to standard error naming
every command of the table with a one-line summary, write no file and exit with code 2. An unknown option, a missing
option value or a wrong number of arguments of a command is a usage error with code 2.

Every command SHALL exit with one of these codes: `0` — done; `1` — the input was rejected by a rule (`apply`) or
refused by the codec (`import-md`), and nothing was written; `2` — a usage error or a refusal of the environment: a
missing or an existing store, an invalid init configuration, a broken ledger (REQ-CL-004), a ledger whose tail moved
during the command (LG-C03), a refused export (REQ-CL-005), an unreadable or unwritable file. A refusal with code 2 is
decided before anything is written, except a failure of the file system during a write: the skeleton has no lock,
`fsync` or recovery (LG-C06 comes with the store adapters of S0), so after such a failure the store may hold a partial
write, and the message names the file. Messages of codes 1 and 2 go to standard error, except the rejections of `apply`
(REQ-CL-004). A path a command prints is relative to the project root, with `/` as separator.

Implements: PL-E02, LG-S05

#### Scenario: An unknown command prints the usage
<!-- id: SCN-CL-001 -->
- **WHEN** `lattice` runs without arguments, then with the argument `frobnicate`, then as `lattice export` without
  `--out`, in an empty folder
- **THEN** each run exits with code 2; the standard error of the first two names `init`, `import-md`, `apply` and
  `export`; the folder stays empty

### Requirement: init creates an empty project store
<!-- id: REQ-CL-002 -->

`lattice init --namespace <namespace> --owner <login>` SHALL create the folder `store/` with the init configuration
`store/lattice.json` — the canonical JSON (RFC 8785) of `{"namespace": <namespace>, "owner": <login>}` followed by one
line feed —, an empty ledger `store/knowledge.jsonl` and an empty folder `store/proposals/`, and exit with code 0.

It SHALL refuse with code 2, writing nothing, when `store/` already exists; when an option is missing; when the
namespace does not match `[a-z][a-z0-9-]*` (OM-I05), is longer than 64 characters, or is `core` or `std` (reserved,
CT-N02); or when the login does not match `[A-Za-z0-9-]+`.

Every other command reads `store/lattice.json` first; a missing `store/` or a configuration that is not exactly the
form above is refused with code 2.

In the skeleton the ledger starts empty: genesis, `std` and the namespace commit (LG-G04) are not written by `init`.

Implements: CT-N05, LG-S05

#### Scenario: A store is created once
<!-- id: SCN-CL-002 -->
- **WHEN** `lattice init --namespace lattice --owner Homasters-max` runs in an empty folder, then the same command runs
  again, then `lattice init --namespace Lattice --owner Homasters-max` and `lattice init --namespace std --owner
  Homasters-max` run in other empty folders
- **THEN** the first run exits with code 0 and leaves `store/lattice.json` equal to
  `{"namespace":"lattice","owner":"Homasters-max"}` and a line feed, an empty `store/knowledge.jsonl` and an empty
  `store/proposals/`; the second run exits with code 2 and leaves the store byte for byte as it was; the last two exit
  with code 2 and create no `store/`

### Requirement: import-md writes a proposal from a table with IDs
<!-- id: REQ-CL-003 -->

`lattice import-md <file>` SHALL read an `md` file and, if it is in the skeleton form of the codec, write one proposal
file into `store/proposals/` (REQ-CL-004, **Proposal**), named `<proposal hash>.json`, print its path and exit with code
0. It writes nothing into the ledger. When a file of that name already exists the command refuses with code 2.

The skeleton form, checked in this order — the first deviation is refused with code 1, its standard error naming the
line (line 0 for the file name), and nothing is written:
1. the file name is `<stem>.md` with `<stem>` matching `[A-Za-z0-9][A-Za-z0-9._-]*`, and `<stem>` in lower case
   matches `[a-z0-9][a-z0-9.-]*`;
2. the bytes are valid UTF-8 without a byte order mark; lines end with a line feed, the last line too, and no line
   holds a carriage return;
3. the first line is the header; the second line is the separator; then at least one row; nothing else;
4. every line is written exactly as `| ` + its cells joined by ` | ` + ` |`; no cell holds `|`, and no cell starts or
   ends with a space;
5. the header has at least two cells; its first cell is `ID`; the other cells are non-empty, distinct, none of them is
   `ID`, and each gives a non-empty slug (below); the separator has one cell `---` per header cell; every row has as
   many cells as the header;
6. the first cell of a row is an ID matching `[A-Z][A-Z0-9]*-[A-Z0-9]+`; IDs are unique in the file, and no ID in lower
   case equals `<stem>` in lower case;
7. every cell is text the kernel admits (REQ-KR-002: NFC, assigned code points of Unicode 16.0).

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

Implements: LG-B05, LG-B06, LG-B07, LG-P01, LG-B03

#### Scenario: The fixture table becomes a proposal
<!-- id: SCN-CL-003 -->
- **WHEN** `lattice import-md` runs on the fixture `fixture.md` — a header `| ID | Rule |` and three rows `FX-A01`,
  `FX-A02`, `FX-A03` — in a store of namespace `lattice`
- **THEN** it exits with code 0 and prints `store/proposals/<hash>.json`, the only file of `store/proposals/`; the
  ledger stays empty; the proposal holds five intents: the session event with the purpose `import`; the entities
  `lattice/fx-a01`, `lattice/fx-a02`, `lattice/fx-a03` of type `lattice/table.rule@1` with `base` 0 and bodies
  `{"Rule": "<text>"}`; and the entity `lattice/fixture` of type `lattice/document@1` whose body references the three
  rows in table order

#### Scenario: Input outside the skeleton form is refused
<!-- id: SCN-CL-004 -->
- **WHEN** `lattice import-md` runs, in an initialised store, on a copy of the fixture whose third line is
  `|FX-A01|text|`; on one with a paragraph after the table; on one with two rows of the ID `FX-A01`; on one whose last
  line has no line feed; on one with a header `| ID | Rule | Rule |`; on one with a header and separator but no row; on
  a file `fx-a01.md` holding a row `FX-A01`; then on the fixture file in a folder without a store
- **THEN** every run but the last exits with code 1, its standard error naming the line of the deviation (line 0 for
  `fx-a01.md`), and `store/proposals/` stays empty; the last run exits with code 2 and creates nothing

### Requirement: apply turns a proposal into a commit or into rejections
<!-- id: REQ-CL-004 -->

`lattice apply <proposal file>` SHALL accept only a file directly in `store/proposals/` (another path is a usage error,
code 2), open the ledger, check the intents of the proposal against it, and then either append exactly one commit and
remove the proposal file (LG-P04), or write nothing and report rejections.

**Hashes.** Every hash is the existing kernel hash — 64 lowercase hex digits of `sha256(JCS({"body": <value>, "type":
<type id>}))` — with this type id and value: a commit — `core/commit` and the commit object; an entity record —
its type without the `@n` suffix and its body (OM-H01 over `type@n` comes with the kernel of S0, design I-1); a
proposal — `core/proposal` and the list of its intents in canonical order.

**Opening (LG-C04).** Every line of `store/knowledge.jsonl` is the canonical JSON (RFC 8785) of one commit object
followed by a line feed; the `seq` of the first commit is at least 1 and every next `seq` is greater than the one before
it; `prev` of the first commit is `null` and `prev` of every other commit is the hash of the commit before it. A ledger
that breaks any of this SHALL be refused with code 2, the message naming `LG-C04` and the `seq` of the first broken
commit (or its line, when it has no readable `seq`), and nothing is written.

**Proposal (LG-P01).** A proposal file holds text the kernel admits as I-JSON (REQ-KR-002) whose value is an object
with exactly one key `intents`, a list. Each intent is an object with exactly the keys of its kind:
- an entity intent `{"kind": "entity", "id", "type", "base", "by", "body"}`;
- an event intent `{"kind": "event", "id", "type", "by", "at", "body"}`;

where `id` and `by` are identifiers `namespace/local` of the kernel grammar (REQ-KR-005), `type` is a pinned reference
`namespace/local@n`, `base` is an integer from 0 to 2^53−1, `at` is a string `YYYY-MM-DDTHH:MM:SS.mmmZ`, and `body` is
any JSON value. Exactly one intent is the session event — an event intent of type `core/session@1` —, and every intent's
`by` is the `id` of that session.

**Rejections.** The intents are checked against one state: the latest-revision projection (LG-J01) of the opened
ledger (LG-J03). A rejection is `{intent, rule, message, path, expected, got}` (LG-A02), `path` being a JSON pointer
into the proposal and `message` a non-empty text. The rejections of the skeleton:

| Rule | When | `intent` | `path` | `expected` | `got` |
|---|---|---|---|---|---|
| `LG-P01` | the text is not admitted, or the value is not an object with exactly the key `intents` holding a list | `null` | `""`, or `/intents` | `null` | `null` |
| `LG-P01` | an intent is not an object, has a missing or an extra key, a `kind` other than `entity` / `event`, or a field outside the form above | the intent's `id` if it is a string, else `null` | `/intents/<i>` for the intent itself, `/intents/<i>/<key>` for a key | `null` | `null` |
| `LG-P01` | the proposal does not hold exactly one session event (checked only when every intent passed the row above) | `null` | `/intents` | `1` | the number of session events |
| `LG-P01` | an intent's `by` is not the `id` of the session (checked only when there is exactly one) | the intent's `id` | `/intents/<i>/by` | the session `id` | the intent's `by` |
| `LG-C07` | a second intent names an `id` an earlier intent of the list already names | that `id` | `/intents/<i>/id` of the later intent | `null` | `null` |
| `LG-P02` | an entity intent's `base` differs from the latest revision of its `id` in the projection (`0` when the `id` has none) | the intent's `id` | `/intents/<i>/base` | the latest revision | the `base` |

`<i>` is the position of the intent in the file, from 0. `LG-C07` and `LG-P02` are checked only when no `LG-P01`
rejection was found. When there is at least one rejection, `apply` SHALL print the JSON list of all rejections on
standard output, ordered by `intent` (`null` first, then by UTF-16 code units), then by `rule`, then by `path` (both by
UTF-16 code units), then by the order in which they were found; keep the proposal file; write nothing; and exit with
code 1.

**Commit (LG-C01, LG-C02).** Otherwise `apply` SHALL append one line holding the canonical JSON of the commit
`{"seq", "prev", "kernel", "base", "proposal", "by", "at", "records"}`: `seq` one more than the `seq` of the last commit
(`1` for an empty ledger); `prev` the hash of the last commit or `null`; `kernel` `"0"` (LG-G05); `base` the `seq` of
the last commit or `0`; `proposal` the proposal hash; `by` and `at` those of the session event; `records` in canonical
order — entity records by `id`, then event records by `id`, by UTF-16 code units (LG-C07). An entity record is
`{"id", "rev", "type", "hash", "by", "at", "body"}` with `rev` = `base` + 1 and `at` = the `at` of the commit; an event
record is `{"id", "type", "by", "at", "body"}` (OM-E01). If the tail moved between opening and appending (LG-C03), the
command refuses with code 2 and writes nothing. After the append it SHALL remove the proposal file, print
`{"outcome":"commit","seq":<seq>}` and exit with code 0; if the removal fails, the commit stays, and the command exits
with code 2 naming the proposal file left behind.

Implements: LG-A01, LG-A02, LG-C01, LG-C02, LG-C03, LG-C04, LG-C07, LG-P01, LG-P02, LG-P04, LG-J03

#### Scenario: The fixture proposal becomes the first commit
<!-- id: SCN-CL-005 -->
- **WHEN** `lattice apply` runs on the proposal written by SCN-CL-003 on an empty ledger
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":1}`; the ledger holds one line: a commit with
  `seq` 1, `prev` `null`, `base` 0, `kernel` `"0"`, the proposal hash, `by` and `at` of the session, and five records —
  `lattice/fixture`, `lattice/fx-a01`, `lattice/fx-a02`, `lattice/fx-a03` at `rev` 1, then the session event; the
  proposal file is gone

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
  and the other `id` as `got`; the fourth exactly one `LG-C07` with `path` `/intents/5/id`

#### Scenario: A broken hash chain is refused
<!-- id: SCN-CL-008 -->
- **WHEN** a ledger of two commits has one letter of a row text in commit 1 changed, keeping each line canonical JSON,
  and `lattice apply` runs on a proposal in `store/proposals/`
- **THEN** it exits with code 2, its message names `LG-C04` and `seq` 2, and the ledger and the proposal are unchanged

### Requirement: export renders md from the latest revisions
<!-- id: REQ-CL-005 -->

`lattice export --out <folder>` SHALL open the ledger as `apply` does (REQ-CL-004; a broken ledger is refused with code
2), build the latest-revision projection (LG-J01) and read entities only through it. The documents are the entities in
it of type `<namespace>/document@1` (the namespace of `store/lattice.json`). For every document it SHALL render the
file named by the `file` of its body, in the skeleton form of REQ-CL-003: the header `ID` and the `columns` of the
body; the separator; then, for every reference of `rows` in its order, the row of the latest revision of the referenced
entity (a floating reference resolves to the latest revision, OM-R01): the local part of its `id` in upper case, then
the value of each column's field of its body.

Before writing anything, export SHALL refuse with code 2 when a document's `file` is not `<stem>.md` as REQ-CL-003
step 1 requires; when two documents name the same `file`; when a body lacks `file`, `columns` or `rows` or holds them
in another shape; when a reference names no entity in the projection; when a row lacks a column's field or holds a
value that is not a string; or when a rendered line would break the skeleton form (a cell with `|` or a line feed, or
starting or ending with a space). Otherwise it creates the folder when missing, writes every file into it (an existing
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
