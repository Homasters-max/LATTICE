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
every command of the table with a one-line summary, write no file and exit with code 2.

Every command SHALL exit with one of these codes: `0` — done; `1` — the input was rejected by a rule (apply) or refused
by the codec (`import-md`), and nothing was written; `2` — a usage error or a refusal of the environment (a missing or
an existing store, a broken ledger, an unreadable file), and nothing was written. A message of code 1 or 2 goes to
standard error, except the rejections of `apply` (REQ-CL-004).

Implements: PL-E02, LG-S05

#### Scenario: An unknown command prints the usage
<!-- id: SCN-CL-001 -->
- **WHEN** `lattice` runs without arguments, then with the argument `frobnicate`, in an empty folder
- **THEN** each run exits with code 2, its standard error names `init`, `import-md`, `apply` and `export`, and the
  folder stays empty

### Requirement: init creates an empty project store
<!-- id: REQ-CL-002 -->

`lattice init --namespace <namespace> --owner <login>` SHALL create the folder `store/` with the init configuration
`store/lattice.json` — the canonical JSON (RFC 8785) of `{"namespace": <namespace>, "owner": <login>}` followed by one
line feed —, an empty ledger `store/knowledge.jsonl` and an empty folder `store/proposals/`, and exit with code 0.

It SHALL refuse with code 2, writing nothing, when `store/` already exists, when an option is missing, when the
namespace does not match `[a-z][a-z0-9-]*` (OM-I05), or when the login does not match `[A-Za-z0-9-]+`.

In the skeleton the ledger starts empty: genesis, `std` and the namespace commit (LG-G04) are not written by `init`.

Implements: CT-N05, LG-S05

#### Scenario: A store is created once
<!-- id: SCN-CL-002 -->
- **WHEN** `lattice init --namespace lattice --owner Homasters-max` runs in an empty folder, then the same command runs
  again, then `lattice init --namespace Lattice --owner Homasters-max` runs in another empty folder
- **THEN** the first run exits with code 0 and leaves `store/lattice.json` equal to
  `{"namespace":"lattice","owner":"Homasters-max"}` and a line feed, an empty `store/knowledge.jsonl` and an empty
  `store/proposals/`; the second run exits with code 2 and leaves the store byte for byte as it was; the third exits
  with code 2 and creates no `store/`

### Requirement: import-md writes a proposal from a table with IDs
<!-- id: REQ-CL-003 -->

`lattice import-md <file>` SHALL read an `md` file and, if it is in the skeleton form of the codec, write one proposal
into `store/proposals/<proposal hash>.json`, print the path of the proposal relative to the project root on standard
output and exit with code 0. It writes nothing into the ledger.

The skeleton form is exactly one table, and nothing else: lines end with a line feed (the last one too) and hold no
carriage return; the first line is the header, whose first cell is `ID`; the second line is the separator, one `---`
cell per column; every further line is a row with as many cells as the header; the first cell of a row is an ID
matching `[A-Z][A-Z0-9]*-[A-Z0-9]+`, and IDs are unique in the file; every line is written exactly as `| ` + its cells
joined by ` | ` + ` |`, and no cell holds `|` or starts or ends with a space; the file name without `.md`, in lower
case, matches `[a-z0-9][a-z0-9.-]*`. Any other input SHALL be refused with code 1, naming the line of the first
deviation on standard error, and nothing is written. Without a store the command refuses with code 2.

The proposal holds intents (LG-P01), every one carrying its `by` — the session of the import:
- one event intent of the session: type `core/session@1`, an `id` in the store namespace made from a new ULID, `at`
  from the clock, `by` its own `id`, a body naming the participant kind `machine` and the purpose `import` (TR-B02);
- one entity intent per row: `id` `<namespace>/<ID in lower case>` (LG-B06), a type given by the header — one type per
  distinct header, the same for every row of the table —, the expected revision `0`, and a body holding one field per
  column after `ID`, named by the header cell, holding the cell text;
- one entity intent of the document: `id` `<namespace>/<file name without .md, in lower case>`, the expected revision
  `0`, and a body holding the file name, the header cells in order and one floating reference per row, in the order of
  the rows (OM-C01, OM-R02).

The proposal hash is the hash (OM-H01, with the existing kernel hash) of the intents in canonical order (LG-C02,
LG-C07): entity intents by `id`, then event intents by `id`.

Implements: LG-B05, LG-B06, LG-B07, LG-P01, LG-B03

#### Scenario: The fixture table becomes a proposal
<!-- id: SCN-CL-003 -->
- **WHEN** `lattice import-md` runs on the fixture `md` file of three rows in an initialised store
- **THEN** it exits with code 0, prints the path of exactly one new file in `store/proposals/`, the ledger stays empty,
  and the proposal holds five intents: one session event with the purpose `import`, three row entities whose ids are
  the lower-cased IDs in the store namespace and whose expected revision is `0`, and one document entity whose body
  references the three rows in table order

#### Scenario: Input outside the skeleton form is refused
<!-- id: SCN-CL-004 -->
- **WHEN** `lattice import-md` runs, in an initialised store, on a file whose third line is `|FX-A01|text|`, then on a
  file with a paragraph after the table, then on a file with two rows of the ID `FX-A01`, then on a file whose last line
  has no line feed; and then on the fixture file in a folder without a store
- **THEN** the first four runs exit with code 1, each naming the line of the deviation, and `store/proposals/` stays
  empty; the last run exits with code 2 and creates nothing

### Requirement: apply turns a proposal into a commit or into rejections
<!-- id: REQ-CL-004 -->

`lattice apply <proposal file>` SHALL open the ledger, verify its hash chain, check the intents of the proposal, and
then either append exactly one commit and remove the proposal file (LG-P04), or write nothing and report rejections.

**Opening (LG-C04).** Every line of `store/knowledge.jsonl` is the canonical JSON of one commit followed by a line
feed; `seq` grows from line to line; `prev` of the first commit is `null` and `prev` of every other commit is the hash
of the commit before it. A ledger that breaks any of this SHALL be refused with code 2, the message naming `LG-C04` and
the `seq` (or line) of the first broken commit, and nothing is written.

**Checks.** The intents are checked against one state: the latest-revision projection (LG-J01) of the opened ledger.
The rejections of the skeleton are:
- `LG-P01` — the proposal is not an object with a list of intents; an intent is neither an entity intent
  `{kind, id, type, base, by, body}` nor an event intent `{kind, id, type, by, at, body}` with every field of its kind
  present and well-formed; the proposal holds not exactly one session event (type `core/session@1`); an intent's `by`
  is not the `id` of that session;
- `LG-P02` — an entity intent's expected revision `base` differs from the latest revision of its `id` in the
  projection (`0` when the `id` has none).

A rejection is `{intent, rule, message, path, expected, got}` (LG-A02): `intent` is the `id` the intent names, or
`null` when it names none; `path` is a JSON pointer into the proposal; `expected` and `got` are the values the rule
compared, or `null`. When there is at least one rejection, `apply` SHALL print the JSON list of all rejections on
standard output, ordered by `intent` (`null` first), then `rule`, then `path`, keep the proposal file, write nothing
and exit with code 1.

**Commit (LG-C01, LG-C02).** Otherwise `apply` SHALL append one line holding the canonical JSON of the commit
`{seq, prev, kernel, base, proposal, by, at, records}`: `seq` one more than the last commit (`1` for an empty ledger);
`prev` the hash of the last commit or `null`; `kernel` `"0"` (LG-G05); `base` the `seq` of the last commit or `0`;
`proposal` the proposal hash (REQ-CL-003); `by` and `at` those of the session event; `records` in canonical order —
entity records by `id`, then event records by `id` (LG-C07). An entity record is `{id, rev, type, hash, by, at, body}`
with `rev` = `base` + 1 and `at` = the commit `at`; an event record is `{id, type, by, at, body}` (OM-E01). Then it
SHALL remove the proposal file, print `{"outcome":"commit","seq":<seq>}` and exit with code 0.

Implements: LG-A01, LG-A02, LG-C01, LG-C02, LG-C04, LG-P01, LG-P02, LG-P04, LG-J03

#### Scenario: The fixture proposal becomes the first commit
<!-- id: SCN-CL-005 -->
- **WHEN** `lattice apply` runs on the proposal written by SCN-CL-003 on an empty ledger
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":1}`; the ledger holds one line: a commit with
  `seq` 1, `prev` `null`, `base` 0, `kernel` `"0"`, the proposal hash, `by` and `at` of the session, and five records —
  the four entities at `rev` 1 ordered by `id`, then the session event; the proposal file is gone

#### Scenario: A second import of the same table is rejected by LG-P02
<!-- id: SCN-CL-006 -->
- **WHEN** after SCN-CL-005 `lattice import-md` runs again on the same fixture file and `lattice apply` runs on its
  proposal
- **THEN** `apply` exits with code 1 and prints four rejections, one per entity intent, each with `rule` `LG-P02`,
  `expected` 1 and `got` 0; the ledger is byte for byte as before and the proposal file stays

#### Scenario: A malformed proposal is rejected by LG-P01
<!-- id: SCN-CL-007 -->
- **WHEN** `lattice apply` runs on a proposal without a session event, then on a proposal whose row intent has no
  `by`
- **THEN** each run exits with code 1 and prints rejections with `rule` `LG-P01` and the JSON pointer of the missing
  part; the ledger is unchanged

#### Scenario: A broken hash chain is refused
<!-- id: SCN-CL-008 -->
- **WHEN** a ledger of two commits has one character of a body of commit 1 changed, and `lattice apply` runs on any
  proposal
- **THEN** it exits with code 2, its message names `LG-C04` and `seq` 2, and the ledger and the proposal are unchanged

### Requirement: export renders md from the latest revisions
<!-- id: REQ-CL-005 -->

`lattice export --out <folder>` SHALL open the ledger as `apply` does (REQ-CL-004, a broken ledger refused with code
2), build the latest-revision projection (LG-J01) and, for every document entity in it, write the file named in the
document's body into the folder — created when missing, an existing file overwritten — in the skeleton form of
REQ-CL-003: the header from the document, the separator, then one row per reference of the document in its order, read
from the latest revision of the referenced entity (a floating reference resolves to the latest revision, OM-R01).
Export SHALL read entities only through the projection. It prints the written paths, one per line, and exits with code
0. Without `--out` it refuses with code 2.

Implements: LG-J01, LG-B05, OM-R01

#### Scenario: Export follows the latest revision of a row
<!-- id: SCN-CL-009 -->
- **WHEN** after SCN-CL-005 a proposal with a session event and one entity intent for the second row — expected
  revision 1, a changed text — is applied, and `lattice export --out out` runs
- **THEN** export exits with code 0 and `out/<fixture file name>` equals the fixture file except the text of the second
  row, which is the changed text

### Requirement: The fixture md makes a byte-identical round trip
<!-- id: REQ-CL-006 -->

For the synthetic fixture `md` (one table with IDs), `lattice init`, `lattice import-md <fixture>`, `lattice apply
<proposal>` and `lattice export --out <folder>` run in that order on an empty folder SHALL each exit with code 0, and
the exported file SHALL be byte-identical to the fixture. A test SHALL run this path through the `lattice` entry as a
child process, so CI checks it on every pull request.

Implements: SL-T09, LG-B05

#### Scenario: The round trip gives the same bytes
<!-- id: SCN-CL-010 -->
- **WHEN** the four commands run in order through the `lattice` entry in an empty temporary folder on the fixture `md`
- **THEN** every command exits with code 0 and the exported file is byte-identical to the fixture
