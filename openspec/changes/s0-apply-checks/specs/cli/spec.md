# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: apply turns a proposal into a commit or into rejections`
- TO: `### Requirement: apply turns a proposal into a commit, a no-op or rejections`

## MODIFIED Requirements

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
existing store, an invalid init configuration, a broken ledger (REQ-CL-004), a store that answers that the tail moved
while it has not (REQ-CL-004), a refused export (REQ-CL-005), an unreadable or unwritable file. A refusal with code 2 is
decided before anything is written, except a failure of the file system during a write: the skeleton has no lock,
`fsync` or recovery (LG-C06 comes with the store adapters of S0), so after such a failure the store may hold a partial
write, and the message names the file. Messages of codes 1 and 2 go to standard error, except the rejections of `apply`
(REQ-CL-004). A path a command prints is relative to the project root when it lies under it, otherwise absolute;
its separator is `/`.

Implements: PL-E02, LG-S05

#### Scenario: An unknown command prints the usage
<!-- id: SCN-CL-001 -->
- **WHEN** `lattice` runs without arguments, then with the argument `frobnicate`, then as `lattice export` without
  `--out`, in an empty folder
- **THEN** each run exits with code 2; the standard error of the first two names `init`, `import-md`, `apply` and
  `export`; the folder stays empty

### Requirement: apply turns a proposal into a commit, a no-op or rejections
<!-- id: REQ-CL-004 -->

`lattice apply <proposal file>` SHALL accept only a file directly in `store/proposals/` (another path is a usage error,
code 2), open the ledger, read the proposal file (REQ-LG-001) and apply it (REQ-LG-003), and act on the outcome as
below. The proposal file is the one the command removes on success (LG-P04).

**Opening (LG-C04).** Every line of `store/knowledge.jsonl` is the canonical JSON (RFC 8785) of one commit object
followed by a line feed; a commit has exactly the keys of the commit form of REQ-LG-003, and its `records` is a list of
objects, each with exactly the keys of the entity record or of the event record form of REQ-LG-003; the `seq` of the
first commit is at least 1 and every next `seq` is greater than the one before it; `prev` of the first commit is
`null` and `prev` of every other commit is the commit hash (REQ-LG-003) of the commit before it. A ledger that breaks
any of this SHALL be refused with code 2, the message naming `LG-C04` and the `seq` of the first broken commit (or its
line, when it has no readable `seq`), and nothing is written.

**Proposal.** A proposal file holds a proposal of the form of REQ-LG-001; the rejections of reading it are those of
REQ-LG-001.

**Outcomes.**
- `rejected` — the rejections of reading the proposal (REQ-LG-001), of apply (REQ-LG-002) or of the check of the tail
  (REQ-LG-004): `apply` SHALL print the JSON list of all rejections on standard output, in the order of REQ-LG-002;
  keep the proposal file; write nothing; and exit with code 1.
- `commit` — `apply` SHALL append one line holding the commit text after the `seq` of the commit's `base`. When the
  store answers that the tail moved, it SHALL open the ledger again — refusing with code 2 if it is broken — and check
  the commit against it (REQ-LG-004): `existing` is the outcome `existing` below; the rejection `LG-C03` is the outcome
  `rejected` above; when the check gives neither, the store answered `moved` on an unmoved tail and the command
  refuses with code 2 naming the store. After the append it SHALL remove the proposal file, print
  `{"outcome":"commit","seq":<seq>}` and exit with code 0; if the removal fails, the commit stays, and the command
  exits with code 2 naming the proposal file left behind.
- `existing` (LG-C08) — `apply` SHALL write nothing to the ledger, remove the proposal file, print
  `{"outcome":"commit","seq":<seq of that commit>}` and exit with code 0, so a run interrupted between the append and
  the removal ends as it would have.
- `no-op` (LG-C05) — `apply` SHALL write nothing to the ledger, remove the proposal file, print `{"outcome":"no-op"}`
  and exit with code 0.

A removal that fails after `existing` or `no-op` is refused with code 2 naming the proposal file.

Implements: LG-A01, LG-A02, LG-C03, LG-C04, LG-C05, LG-C08, LG-P04, LG-J03

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
  and the other `id` as `got`; the fourth exactly one `LG-C07` with `path` `/intents/5/id`, `with` that intent's `id`
  and `differs` `[]`

#### Scenario: A tail that moved during apply is refused
<!-- id: SCN-CL-011 -->
- **WHEN** `apply` runs on the fixture proposal against a store whose ledger gains a commit of another proposal
  between opening and appending, so the store answers that the tail moved
- **THEN** it exits with code 1 and prints exactly one rejection `LG-C03` with `intent` `null`, `path` `""`, `expected`
  0 and `got` 1; it appends nothing — the ledger holds only the other writer's commit — and the proposal file stays

#### Scenario: A broken hash chain is refused
<!-- id: SCN-CL-008 -->
- **WHEN** a ledger of two commits has one letter of a row text in commit 1 changed, keeping each line canonical JSON,
  and `lattice apply` runs on a proposal in `store/proposals/`
- **THEN** it exits with code 2, its message names `LG-C04` and `seq` 2, and the ledger and the proposal are unchanged

#### Scenario: An unchanged proposal is a no-op
<!-- id: SCN-CL-012 -->
- **WHEN** after SCN-CL-005 `lattice apply` runs on a proposal file in `store/proposals/` holding a new session event
  and the four entity intents of the first commit, each with `base` 1, `by` the new session's `id` and its type and
  body unchanged
- **THEN** it exits with code 0 and prints `{"outcome":"no-op"}`; the ledger is byte for byte as before; the proposal
  file is gone

#### Scenario: A proposal applied again answers its commit
<!-- id: SCN-CL-013 -->
- **WHEN** after SCN-CL-005 the proposal file of SCN-CL-003 is written back into `store/proposals/` with the same
  bytes and `lattice apply` runs on it
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":1}`; the ledger is byte for byte as before; the
  proposal file is gone
