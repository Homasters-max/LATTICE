# Spec Delta

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

Every command SHALL exit with one of these codes: `0` — done; `1` — the input was rejected by a rule (`apply`) or
refused by the codec (`import-md`), and nothing was written by the command; `2` — a usage error or a refusal of the
environment: a missing or an existing store, an invalid init configuration, a broken ledger (REQ-CL-004), a ledger
whose tail moved during the command or whose lock another writer holds (LG-C03, REQ-SR-002), a refused export
(REQ-CL-005), an unreadable or unwritable file. A refusal with code 2 is decided before anything is written, except a
failure of the file system while the command writes or while the ledger opens: its message names the file the command
was writing — the ledger file `store/knowledge.jsonl` for anything the store does — followed by the message of the
operating system. After such a failure while appending a commit, the commit may be in the ledger (REQ-SR-003) or a line
cut by it is left, which the next opening recovers (REQ-SR-004); the proposal file stays, and re-applying it is not
idempotent until LG-C08 is checked by apply — its entity intents are then rejected by `LG-P02`. A proposal or an exported file may stay partly written.

Opening the ledger is not a write of the command: when it recovers a torn tail into `store/recovered/` (REQ-SR-004),
that holds whatever the outcome, codes 1 and 2 included, and a recovery that fails may leave a file in
`store/recovered/`. The store of every command is the JSONL adapter on `store/knowledge.jsonl` with a TTL of 10 000 ms:
a lock left by a stopped command makes the next commands that append refuse with code 2 naming `LG-C03` until it
expires, after which it is taken over (REQ-SR-002).

Messages of codes 1 and 2 go to standard error, except the rejections of `apply` (REQ-CL-004). A path a command prints
is relative to the project root when it lies under it, otherwise absolute; its separator is `/`; the message of the
operating system is printed as it is.

Implements: PL-E02, LG-S05, LG-C06

#### Scenario: An unknown command prints the usage
<!-- id: SCN-CL-001 -->
- **WHEN** `lattice` runs without arguments, then with the argument `frobnicate`, then as `lattice export` without
  `--out`, in an empty folder
- **THEN** each run exits with code 2; the standard error of the first two names `init`, `import-md`, `apply` and
  `export`; the folder stays empty

### Requirement: apply turns a proposal into a commit or into rejections
<!-- id: REQ-CL-004 -->

`lattice apply <proposal file>` SHALL accept only a file directly in `store/proposals/` (another path is a usage error,
code 2), open the ledger, check the intents of the proposal against it, and then either append exactly one commit and
remove the proposal file (LG-P04), or write nothing and report rejections.

**Hashes.** Every hash is the existing kernel hash — 64 lowercase hex digits of `sha256(JCS({"body": <value>, "type":
<type id>}))` — with this type id and value: a commit — `core/commit` and the commit object; an entity record —
its type without the `@n` suffix and its body (OM-H01 over `type@n` comes with the kernel of S0, design I-1); a
proposal — `core/proposal` and the list of its intents in canonical order.

**Opening (LG-C04).** The ledger is read through the `store` port (REQ-SR-001), which first moves a torn tail — what
follows the last line feed of `store/knowledge.jsonl` — to a new file in `store/recovered/`, unless another writer
holds an unexpired lock, in which case it opens the commits before the tail and an append answers `moved`
(REQ-SR-004); the checks below run on the commits the store returns. Every line of `store/knowledge.jsonl` is the canonical JSON (RFC 8785) of one commit object
followed by a line feed; a commit has exactly the keys of the commit form below, and its `records` is a list of
objects, each with exactly the keys of the entity record or of the event record form below; the `seq` of the first commit is at least 1 and every next `seq` is greater than the one before
it; `prev` of the first commit is `null` and `prev` of every other commit is the hash of the commit before it. A ledger
that breaks any of this SHALL be refused with code 2, the message naming `LG-C04` and the `seq` of the first broken
commit (or its line, when it has no readable `seq`), and nothing is written by the command (REQ-CL-001).

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
| `LG-P01` | the text is not admitted, or the value is not an object with exactly the key `intents` (one rejection); or `intents` is not a list (one rejection) | `null` | `""`; `/intents` when `intents` is not a list | `null` | `null` |
| `LG-P01` | an intent fails the form above — one rejection per intent, at the first failing check in this order: not an object (`/intents/<i>`); `kind` missing or neither `entity` nor `event` (`/intents/<i>/kind`); the first key of its kind, in the order of the form above, that is missing or outside the form (`/intents/<i>/<key>`); the first extra key by UTF-16 code units (`/intents/<i>/<key>`) | the intent's `id` if it is a string, else `null` | as given in this row | `null` | `null` |
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
record is `{"id", "type", "by", "at", "body"}` (OM-E01). If the store answers `moved` — the tail moved between opening
and appending, or another writer holds the lock of the ledger or took it over before the write (LG-C03, REQ-SR-002) —,
the command refuses with code 2, its message naming `LG-C03`, and writes nothing. After the append it SHALL remove the
proposal file, print `{"outcome":"commit","seq":<seq>}` and exit with code 0; if the removal fails, the commit stays, and the command exits
with code 2 naming the proposal file left behind.

Implements: LG-A01, LG-A02, LG-C01, LG-C02, LG-C03, LG-C04, LG-C06, LG-C07, LG-P01, LG-P02, LG-P04, LG-J03

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

#### Scenario: A tail that moved during apply is refused
<!-- id: SCN-CL-011 -->
- **WHEN** `apply` runs on the fixture proposal against a store whose ledger gains a commit between opening and
  appending, so the store answers that the tail moved; then, in an initialised store, while the lock file
  `store/knowledge.jsonl.lock.1` holds a lock of another owner that expires long after now; then while it holds a lock
  of another owner that expired at 0
- **THEN** the first two runs exit with code 2, their message names `LG-C03`, they append nothing and the proposal file
  stays, and the unexpired lock of the other owner is unchanged; the third run exits with code 0, appends the commit
  `seq` 1, removes the proposal file and leaves no lock file

#### Scenario: A torn tail is recovered before apply
<!-- id: SCN-CL-012 -->
- **WHEN** in an initialised store `store/knowledge.jsonl` holds only the first 20 bytes of a commit line, without a
  line feed, and `lattice apply` runs on the fixture proposal written by SCN-CL-003
- **THEN** it exits with code 0 and prints `{"outcome":"commit","seq":1}`; the ledger holds one line, the commit `seq`
  1 with `prev` `null`; `store/recovered/` holds one file whose bytes are exactly those 20 bytes; no lock file is left

#### Scenario: A broken hash chain is refused
<!-- id: SCN-CL-008 -->
- **WHEN** a ledger of two commits has one letter of a row text in commit 1 changed, keeping each line canonical JSON,
  and `lattice apply` runs on a proposal in `store/proposals/`
- **THEN** it exits with code 2, its message names `LG-C04` and `seq` 2, and the ledger and the proposal are unchanged

