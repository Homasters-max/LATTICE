# ledger Specification

## Purpose
TBD - created by archiving change s0-apply-checks. Update Purpose after archive.

## Requirements

### Requirement: A proposal has one form
<!-- id: REQ-LG-001 -->

A proposal is the input of apply (LG-P01). Its text SHALL be text the kernel admits as I-JSON (REQ-KR-002) whose value
is an object with exactly one key `intents`, a list. Each intent is an object with exactly the keys of its kind:
- an entity intent `{"kind": "entity", "id", "type", "base", "by", "body"}`;
- an event intent `{"kind": "event", "id", "type", "by", "at", "body"}`;

where `id` and `by` are identifiers `namespace/local` of the kernel grammar (REQ-KR-005), `type` is a pinned reference
`namespace/local@n`, `base` is an integer from 0 to 2^53−1, `at` is a string `YYYY-MM-DDTHH:MM:SS.mmmZ`, and `body` is
any JSON value. Exactly one intent is the session event — an event intent of type `core/session@1` —, and every intent's
`by` is the `id` of that session. A text that is not valid UTF-8 is not admitted.

Reading a proposal SHALL give either the proposal or its `LG-P01` rejections (REQ-LG-002), never both:

| When | `intent` | `path` | `expected` | `got` |
|---|---|---|---|---|
| the text is not admitted, or the value is not an object with exactly the key `intents` (one rejection); or `intents` is not a list (one rejection) | `null` | `""`; `/intents` when `intents` is not a list | `null` | `null` |
| an intent fails the form above — one rejection per intent, at the first failing check in this order: not an object (`/intents/<i>`); `kind` missing or neither `entity` nor `event` (`/intents/<i>/kind`); the first key of its kind, in the order of the form above, that is missing or outside the form (`/intents/<i>/<key>`); the first extra key by UTF-16 code units (`/intents/<i>/<key>`) | the intent's `id` if it is a string, else `null` | as given in this row | `null` | `null` |
| the proposal does not hold exactly one session event (checked only when every intent passed the row above) | `null` | `/intents` | `1` | the number of session events |
| an intent's `by` is not the `id` of the session (checked only when there is exactly one) | the intent's `id` | `/intents/<i>/by` | the session `id` | the intent's `by` |

`<i>` is the position of the intent in the text, from 0; a key in a path is escaped as a JSON pointer (RFC 6901).

The **canonical order** of intents is: entity intents by `id`, then event intents by `id`, both by UTF-16 code units
(LG-C07). The **hash of a list of intents** is the kernel hash — 64 lowercase hex digits of `sha256(JCS({"body":
<value>, "type": <type id>}))` — of type id `core/proposal` over the list in canonical order. The **proposal hash** is
the hash of all intents of the proposal; it names a proposal file (REQ-CL-003). The `proposal` field of a commit
(LG-C02) is the hash of the intents the commit holds (REQ-LG-003); the two are equal for a proposal without no-ops.
For intents with distinct `id`s, neither depends on the order of the intents in the text.

Implements: LG-P01, LG-C07

#### Scenario: A proposal outside the form is rejected by LG-P01
<!-- id: SCN-LG-001 -->
- **WHEN** a proposal is read from the text `{"intents": 5}`; then from the fixture proposal of SCN-CL-003 with the key
  `base` removed from the intent at position 2; then from the fixture proposal of SCN-CL-003 with a second session
  event appended; then from the fixture proposal of SCN-CL-003 with its intents in reverse order
- **THEN** the first gives exactly one rejection `LG-P01` with `intent` `null` and `path` `/intents`; the second exactly
  one with that intent's `id` and `path` `/intents/2/base`; the third exactly one with `intent` `null`, `path`
  `/intents`, `expected` 1 and `got` 2; the last is a proposal whose hash equals the hash of the fixture proposal

### Requirement: A rejection names its rule, its intent and where it fails
<!-- id: REQ-LG-002 -->

A rejection SHALL be `{intent, rule, message, path, expected, got}` (LG-A02): `rule` an ID of the closed list below,
`intent` the `id` of the intent it is about or `null`, `message` a non-empty text, `path` a JSON pointer into the
proposal, `expected` and `got` JSON values. A rejection for a duplicate SHALL also hold `with`, the `id` the intent
collided with, and `differs`, the paths where the colliding intents differ.

The closed list of rule IDs (REQ-AR-011) SHALL be exactly `CT-N02`, `LG-C03`, `LG-C07`, `LG-P01`, `LG-P02`. A Change
that adds a rule to apply changes this list and adds the rule's fixture.

`LG-P01` is found by reading the proposal (REQ-LG-001). Unless it answers `existing` (REQ-LG-003), apply SHALL find,
against one state — the latest-revision projection (LG-J01) of the opened ledger (LG-J03) and the whole proposal —,
every rejection of these rules, never only the first:

| Rule | When | `intent` | `path` | `expected` | `got` | Also |
|---|---|---|---|---|---|---|
| `CT-N02` | an intent's `id` is in a reserved namespace — the first `.`-separated part of its namespace (the part before `/`) is `core` or `std`, so `std/x` and `std.y/x` alike — and no exemption below lifts `CT-N02` for the proposal — one rejection per such intent | the intent's `id` | `/intents/<i>/id` | `null` | `null` | — |
| `LG-C07` | an intent names an `id` that an intent earlier in the text already names — one rejection per such later intent | that `id` | `/intents/<i>/id` of the later intent | `null` | `null` | `with` that `id`; `differs` the paths where the intents naming that `id` differ |
| `LG-P02` | an entity intent's `base` differs from the latest revision of its `id` in the projection (`0` when the `id` has none) | the intent's `id` | `/intents/<i>/base` | the latest revision | the `base` | — |

`core` and `std` are reserved: they are not namespaces and no proposal writes into them (CT-N02), except genesis and
the `std` package, which go through apply like any other commit (LG-A07). The **exemptions** of apply SHALL be a
closed list exported by the ledger module, each naming the rule it lifts and the rule that grants it, and decided from
the proposal and the ledger as a whole — never from an `id` alone:
- `CT-N02` by `LG-G01`: the ledger is empty and the proposal hash (REQ-LG-001) is the hash of the genesis proposal
  (REQ-LG-006);
- `CT-N02` by `LG-G02`: the ledger holds exactly one commit and its commit hash is the genesis hash (REQ-LG-006); the
  body of the session event has `kind` `machine` and `purpose` `init`; the proposal holds no event intent but the
  session event; and its entity intents, as `{"id", "type", "body"}` in canonical order, have the hash of the `std`
  package (REQ-LG-007).

The check of a commit against the ledger it is appended to (REQ-LG-004) finds:

| Rule | When | `intent` | `path` | `expected` | `got` |
|---|---|---|---|---|---|
| `LG-C03` | the tail of the ledger is not the one the commit was built on | `null` | `""` | `{"seq": <the commit's base>, "hash": <the commit's prev>}` | `{"seq": <the seq of the tail>, "hash": <the commit hash of the tail>}`, `{"seq": 0, "hash": null}` for an empty ledger |

`differs` is a list of JSON pointers relative to an intent, ordered by UTF-16 code units, computed over the values of
all intents naming that `id` from the empty pointer: when the values are all equal (as canonical JSON) nothing is
listed; when they are all objects (not lists), each key of their union is visited in order of UTF-16 code units — a key
missing from one of them lists its path, otherwise its values are compared at that path; when they are all lists of the
same length, each position is compared at its path; otherwise the path itself is listed. So two equal intents give
`[]`, and two entity intents that differ only in the text of the body field `Rule` give `["/body/Rule"]`.

Rejections SHALL be ordered by `intent` (`null` first, then by UTF-16 code units), then by `rule`, then by `path` (both
by UTF-16 code units), then by the order in which they were found.

Implements: LG-A02, LG-A03, LG-C07, LG-P02, LG-C03, LG-J03, CT-N02, LG-A07

#### Scenario: A duplicate names the id it collided with and the differing paths
<!-- id: SCN-LG-002 -->
- **WHEN** apply runs on an empty ledger with the fixture proposal of SCN-CL-003 whose intent at position 1 is
  appended once more with the text of its body field `Rule` changed; then with it appended unchanged; then appended
  twice, once changed and once unchanged
- **THEN** the first gives exactly one rejection `LG-C07` with `intent` and `with` that intent's `id`, `path`
  `/intents/5/id` and `differs` `["/body/Rule"]`; the second exactly one with `differs` `[]`; the third exactly two,
  at `/intents/5/id` and `/intents/6/id`, each with `differs` `["/body/Rule"]`

#### Scenario: The rule list is closed
<!-- id: SCN-LG-007 -->
- **WHEN** the list of rule IDs and the list of exemptions exported by the ledger module are read
- **THEN** the rules are exactly `CT-N02`, `LG-C03`, `LG-C07`, `LG-P01`, `LG-P02`; the exemptions are exactly
  `CT-N02` by `LG-G01` and `CT-N02` by `LG-G02`

#### Scenario: Reserved namespaces and their exemptions
<!-- id: SCN-LG-008 -->
- **WHEN** apply runs, on an empty ledger, the fixture proposal of SCN-CL-003 with an entity intent `std/x` of type
  `lattice/table.rule@1` added; the same with `std.y/x` instead of `std/x`; the same with `stdx/x`; the fixture
  proposal with the `id` of its session event, and every `by`, changed to
  `core/01J8ZQ4N7X5K2M9R3T6V8W0Y1A`; the genesis proposal (REQ-LG-006); the genesis proposal with the `at` of its
  session event changed to `1970-01-01T00:00:00.001Z`; the `std` proposal of store init (REQ-LG-008); then, on the
  ledger of the genesis commit, the `std` proposal; the `std` proposal with the body of `std/live` changed; the `std`
  proposal with its session `purpose` `work`; and, on the ledger of store init (SCN-LG-011), the genesis proposal
- **THEN** the first gives exactly one rejection `CT-N02` for `std/x` at its `/intents/<i>/id`; the second exactly one
  for `std.y/x`; the third a commit; the next exactly one `CT-N02` for the session `id`; the genesis proposal a
  commit; the changed genesis exactly three `CT-N02`, one per intent; the `std` proposal on the empty ledger exactly
  four `CT-N02`; on the genesis ledger the `std` proposal gives a commit and each of the other two exactly four
  `CT-N02`; the last answers `existing` with `seq` 1

### Requirement: Apply answers a commit, a no-op, an existing commit or rejections
<!-- id: REQ-LG-003 -->

Apply SHALL be a pure function of the opened ledger, a proposal that passed its form, and a list of acts (LG-A04,
REQ-AC-001; none when none is given) (ST-S03, LG-A01). It assigns only `seq`, `rev` and `hash` (LG-P01); the acts it
records are read through the `acts` port by its caller, and checked once, when the commit is admitted (LG-A05).

An entity intent is a **no-op** (OM-H03) when the latest revision of its `id` in the projection has `rev` equal to the
intent's `base`, the intent's `type`, and the record hash the intent would get; `by` is not compared. In S0 no event
intent is a no-op. The **held intents** of a proposal are its intents that are not no-ops; a commit holds them in full
and nothing else (LG-P04).

Apply answers exactly one of these outcomes, decided in this order:

1. **`existing` (LG-C08)**: when the hash of the held intents (REQ-LG-001) equals the `proposal` of a commit of the
   ledger, apply answers the `seq` of the first such commit and finds nothing else. So a proposal applied again after
   its commit — even one whose other intents were no-ops — answers that commit, as long as no intent that was a no-op
   for it has been written since: then that intent is held, the hash matches no commit, and the proposal is checked
   as any other (its intents meet `LG-P02`).
2. **`rejected`**: the rejections of `CT-N02`, `LG-C07` and `LG-P02` (REQ-LG-002), when there is at least one.
3. **`no-op` (LG-C05)**: when the session event is the only held intent.
4. **`commit` (LG-C01, LG-C02)**: otherwise one commit, built on the tail of the opened ledger: `{"seq", "prev",
   "kernel", "base", "proposal", "by", "at", "records"}`, and `"acts"` when its act record is not empty, with `seq` one
   more than the `seq` of the tail (`1` for an empty ledger); `prev` the commit hash of the tail or `null`; `kernel`
   `"0"` (LG-G05); `base` the `seq` of the tail or `0`; `proposal` the hash of the held intents; `by` and `at` those of
   the session event; `records` one record per held intent, in canonical order (REQ-LG-001). An entity record is
   `{"id", "rev", "type", "hash", "by", "at", "body"}` with `rev` = `base` + 1, `hash` the record hash and `at` the
   `at` of the commit; an event record is `{"id", "type", "by", "at", "body"}` (OM-E01). So the `proposal` of a commit
   is computed from its records alone (LG-P05). Apply also gives the commit's text: its canonical JSON (RFC 8785).

The **act record** of a commit (LG-A05) is built from the given acts: apply keeps every act that names the proposal
hash, the hash of the held intents, or the `id` of a held intent, and records it as `{"login", "names", "ref"}` with
its `login` and `ref`, and with `names` the check result: `[<the commit's proposal>]` when the act names either hash,
otherwise the `id`s of the held intents it names, ordered by UTF-16 code units. An act that names none of these is not
recorded. Equal records are recorded once; the records are ordered by their canonical JSON, by UTF-16 code units. The
key `acts` is absent from a commit whose act record is empty, so a commit without acts keeps the form it had before
acts existed. The outcomes `existing`, `rejected` and `no-op` do not depend on the acts.

The commit form, which opening a ledger checks (REQ-CL-004), is: exactly the eight keys above, or those and `acts`; an
`acts` value is a non-empty list of objects with exactly the keys `login` (a non-empty string), `names` (a non-empty
list of non-empty strings) and `ref` (a non-empty string) — the form of an act (REQ-AC-001); every record of
`records` has exactly the keys of the entity record or of the event record. Apply records only acts of that form: an
act given in another form is not recorded.

Hashes are kernel hashes as in REQ-LG-001: the **commit hash** is of type id `core/commit` over the commit object; the
**record hash** of an entity record is of its type without the `@n` suffix over its body (OM-H01 over `type@n` comes
with s0-kernel #55, design I-1 of `s0-skeleton`).

The ledger **L1** of the scenarios is the ledger of one commit: the fixture proposal of SCN-CL-003 applied on an empty
ledger without acts.

Implements: LG-A01, LG-C01, LG-C02, LG-C05, LG-C08, OM-H03, LG-P01, LG-P04, LG-A05

#### Scenario: Unchanged entities are a no-op, a changed one a commit of only itself
<!-- id: SCN-LG-003 -->
- **WHEN** on L1 apply runs on a proposal of a new session event and the four entity intents of its commit, each with
  `base` 1, `by` the new session's `id` and its type and body unchanged; then on the same proposal with the body of
  `lattice/fx-a02` changed; then on the first proposal with the type of `lattice/fx-a01` changed to
  `lattice/table.rule@2` and its body unchanged; then on a proposal holding only a new session event
- **THEN** the first answers `no-op`; the second a commit with `seq` 2 and `base` 1 whose records are
  `lattice/fx-a02` at `rev` 2 and the session event, and whose `proposal` is the hash of those two intents; the third
  a commit whose records are `lattice/fx-a01` at `rev` 2 of type `lattice/table.rule@2` and the session event (OM-H01:
  another type revision is never a no-op); the fourth `no-op`

#### Scenario: A proposal already in the ledger answers its commit
<!-- id: SCN-LG-004 -->
- **WHEN** apply runs with the fixture proposal of SCN-CL-003 on L1, then on L1 followed by the commit of a proposal
  writing `lattice/fx-a02` at `rev` 2 with a changed text; and the second proposal of SCN-LG-003 runs again on the
  ledger holding its commit, then on that ledger after one more commit writes `lattice/fx-a01` at `rev` 2
- **THEN** the first two answer `existing` with `seq` 1 and find no rejection `LG-P02`; the third answers `existing`
  with `seq` 2; the last answers rejections `LG-P02` for `lattice/fx-a01` and `lattice/fx-a02`

#### Scenario: Acts that confirm intents become the act record
<!-- id: SCN-LG-012 -->
- **WHEN** apply runs, on an empty ledger, the fixture proposal of SCN-CL-003 with the acts, in this order: `d` by
  `Homasters-max` naming `lattice/zzz` (`ref` `u4`); `c` by `Homasters-max` naming another hash (`u3`); `b` by
  `Homasters-max` naming `lattice/fx-a02` and `lattice/fx-a01` (`u2`); `a` by `Homasters-max` naming the proposal hash
  (`u1`); `a` once more; then without acts; then the first proposal of SCN-LG-003 on L1 with the act `a`
- **THEN** the first answers a commit whose `acts` is, in order of canonical JSON,
  `{"login":"Homasters-max","names":[<its proposal>],"ref":"u1"}`,
  `{"login":"Homasters-max","names":["lattice/fx-a01","lattice/fx-a02"],"ref":"u2"}`; the second a commit without the
  key `acts`, whose text is the commit text of L1; the third `no-op`

### Requirement: A commit is appended only on the tail it was built on
<!-- id: REQ-LG-004 -->

A commit names the `seq` it is written after: its `base` (LG-C03). Checking a commit against a ledger SHALL answer, in
this order: `existing` with the `seq` of the first commit of the ledger whose `proposal` equals the commit's
`proposal` (LG-C08), when there is one; no rejection when the ledger's tail is the one the commit was built on — its
`seq` equals the commit's `base` and its commit hash the commit's `prev` (`0` and `null` for an empty ledger), so the
appended commit keeps the hash chain (LG-C04); otherwise exactly one rejection `LG-C03` (REQ-LG-002). The writer of a commit SHALL append
it only after the `seq` of its `base`; when the ledger has moved since it was opened, the writer reads it again and
checks the commit against it. The writer learns of a moved tail only from the store's answer `moved`, which compares
the `seq`: a tail replaced at the same `seq` outside apply (a checkout or a hand edit of the ledger file) is not seen
at the append, and the next opening refuses the broken chain (LG-C04). There are no locks and no automatic merge at
this level; after `LG-C03` the caller applies the proposal again on the new tail (LG-C03).

Implements: LG-C03, LG-C08

#### Scenario: A commit built on an older tail is rejected by LG-C03
<!-- id: SCN-LG-005 -->
- **WHEN** the commit apply builds for the fixture proposal of SCN-CL-003 on an empty ledger is checked against that
  empty ledger, then against a ledger that gained one commit of another proposal, then against a ledger that gained
  the commit of the same proposal
- **THEN** the first gives no rejection; the second exactly one rejection `LG-C03` with `intent` `null`, `path` `""`,
  `expected` `{"seq": 0, "hash": null}` and `got` `{"seq": 1, "hash": <the hash of that other commit>}`; the third
  answers `existing` with `seq` 1

### Requirement: The result of apply does not depend on the order of intents
<!-- id: REQ-LG-005 -->

Reading a proposal and applying it SHALL give, for every permutation of its intents in the text, the same result
(LG-C07): the same outcome; for `commit`, the same commit text and so the same answer of the check of REQ-LG-004; for
`existing`, the same `seq`; for rejections, the same multiset of rejections when each is compared on every field but
`message`, with the prefix `/intents/<i>` of its `path` removed. A text whose value has no list `intents` has only
itself as a permutation.

A permutation test SHALL prove it on these cases, each a proposal, the ledger it is applied to and its acts (none when
not named): every rule fixture (REQ-AR-011), its commit checked against `ledger.jsonl` followed by `moved.jsonl` when
the folder has one; the fixture proposal of SCN-CL-003 on an empty ledger and on L1 (REQ-LG-003); each proposal of
SCN-LG-002 on an empty ledger; each proposal of SCN-LG-003 on L1; the first proposal of SCN-LG-012 with its acts on an
empty ledger; each of the four proposals of store init on the ledger before it, with the acts of REQ-LG-008. It runs
every permutation of a proposal of at most 7 intents, otherwise the reverse order, every rotation and 50 permutations
drawn from a fixed seed.

Implements: LG-C07

#### Scenario: Every permutation of the intents gives the same result
<!-- id: SCN-LG-006 -->
- **WHEN** the permutation test runs on the cases of REQ-LG-005
- **THEN** every permutation of every proposal gives the result of the proposal as written

### Requirement: Genesis is a constant commit of the kernel version
<!-- id: REQ-LG-006 -->

The ledger module SHALL hold the **genesis proposal** (LG-G01, OM-L01), a constant of kernel version `0`; its
session `id` is `core/00000000000000000000000000` and its `at` `1970-01-01T00:00:00.000Z`. Its intents are:
- the entity `core/type`, type `core/type@1`, `base` 0, body the body of the meta-type (`metaType.body`, REQ-KR-016) —
  typed by itself;
- the entity `core/session`, type `core/type@1`, `base` 0, body the session event type, in canonical form
  `{"schema":{"properties":{"established":{"maxLength":128,"type":"string"},"kind":{"enum":["agent","human","machine"],"type":"string"},"of":{"properties":{},"type":"object"},"participant":{"maxLength":128,"type":"string"},"pipeline":{"pinned":true,"ref":"std/pipeline","type":"string"},"purpose":{"enum":["bench","check","import","init","work"],"type":"string"},"software":{"maxLength":128,"type":"string"},"version":{"maxLength":128,"type":"string"}},"required":["kind","of","participant","purpose"],"type":"object"}}`
  — the members of a session of CT-P01: `participant`, `kind`, `purpose` (the closed list of TR-B02) and `of`
  required; `software`, `version`, `established` (how the kind was established, CT-P03) and the `pipeline@n` of a run
  optional, because the sessions written in S0 — the codec's and store init's — do not record them yet, and a later
  kernel version may require them;
- the genesis session event — the session that records itself —, type `core/session@1`, body
  `{"of": {}, "participant": "lattice", "kind": "machine", "purpose": "init"}`;

every `by` the session `id`. Applied without acts on an empty ledger it gives commit 1, the **genesis commit**, whose
commit hash, the **genesis hash**, is a constant of kernel version `0` held by the module next to the proposal; a test
pins its value as a literal. The genesis commit has no act record: its records have basis `inferred` (REQ-TR-001); its
hash cannot depend on any project. Both type bodies are admitted by the kernel under the meta-type.

A new kernel version appends a transition commit to the chain of genesis hashes it knows (LG-G03); kernel `0` knows
only its own genesis, and its mechanics are deferred (LT-01).

Implements: LG-G01, OM-L01, LG-G03

#### Scenario: The genesis commit
<!-- id: SCN-LG-009 -->
- **WHEN** the genesis proposal is applied without acts on an empty ledger, twice; and the kernel `admit` gets each of
  its two type bodies under `metaType`
- **THEN** both answers are the same commit: `seq` 1, `prev` `null`, `base` 0, `kernel` `"0"`, `by`
  `core/00000000000000000000000000`, `at` `1970-01-01T00:00:00.000Z`, no key `acts`, and the records `core/session`
  and `core/type` at `rev` 1 of type `core/type@1`, then the session event; its commit hash equals the genesis hash
  constant and the literal of the test; both admissions succeed

### Requirement: The std package is a constant of the LATTICE version
<!-- id: REQ-LG-007 -->

The `std` package (OM-L02, LG-S05) SHALL be the file `std/std.json` of the LATTICE installation: the canonical JSON
(RFC 8785) of `{"entities": [<entity>, …]}` followed by one line feed, each entity `{"id", "type", "body"}` of type
`core/type@1`, ordered by `id` (UTF-16 code units). The **package hash** is the kernel hash (REQ-LG-001) of type id
`core/std` over the list of entities; it is a constant of the code — of the LATTICE version (LG-G02, LG-G06) —, and a
test pins it.

Reading a package text SHALL refuse, naming `LG-G02`, a text that is not that form or whose package hash is not the
constant; otherwise the **`std` proposal** for a session (`id`, `at`) is: one entity intent per entity, `base` 0,
`by` the session `id`; and the session event, type `core/session@1`, body
`{"of": {}, "participant": "lattice", "kind": "machine", "purpose": "init"}`.

The S0 package holds three types, each body admitted by the kernel under the meta-type, in canonical form:
- `std/live` — the status fact `live` (TR-F05, REQ-TR-002):
  `{"schema":{"properties":{"key":{"properties":{"id":{"type":"string"}},"required":["id"],"type":"object"},"of":{"properties":{"subject":{"type":"string"}},"required":["subject"],"type":"object"},"revoked":{"type":"boolean"},"value":{"type":"integer"}},"required":["key","of"],"type":"object"}}`;
- `std/namespace` — the namespace entity and its policy (CT-N01, CT-N03, REQ-CT-001):
  `{"schema":{"properties":{"owner":{"maxLength":128,"type":"string"},"owner_acts":{"items":{"maxLength":128,"type":"string"},"type":"array"},"writers":{"items":{"properties":{"kind":{"enum":["agent","human","machine"],"type":"string"},"login":{"maxLength":128,"type":"string"}},"type":"object"},"type":"array"}},"required":["owner","owner_acts","writers"],"type":"object"}}`;
- `std/setup` — `setup` (PL-A01): for each recorded port `clock`, `ids`, `judge`, `llm`, `source` (PL-K01) its mode
  (PL-K02) and whether memoization is on (PL-K03): `{"schema":{"properties":{"ports":{"properties":{"clock":P,"ids":P,"judge":P,"llm":P,"source":P},"required":["clock","ids","judge","llm","source"],"type":"object"}},"required":["ports"],"type":"object"}}`
  with `P` = `{"properties":{"memo":{"type":"boolean"},"mode":{"enum":["fixture","recorded","service"],"type":"string"}},"required":["memo","mode"],"type":"object"}`.

The adapter block of a `service` port (PL-A05), the other status fact types of TR-F05 and the rest of OM-L02 come with
their slices, each as a new package version; the store command `upgrade` is slice SW (SL-T07 (3)).

Implements: LG-G02, OM-L02, PL-A01, TR-F05

#### Scenario: The std package is read and its hash checked
<!-- id: SCN-LG-010 -->
- **WHEN** the package text `std/std.json` of the repository is read; then that text with one character of a schema
  changed; then that text without its final line feed; and the kernel `admit` gets each body of the package under
  `metaType`
- **THEN** the first gives the `std` proposal of three entity intents `std/live`, `std/namespace`, `std/setup` and the
  session event, and the package hash equals the constant and the literal of the test; the other two are refused naming
  `LG-G02`; every admission succeeds

### Requirement: Store init is four commits through apply
<!-- id: REQ-LG-008 -->

Store init (LG-G04) SHALL be four proposals, each applied through apply (REQ-LG-003) on the ledger the one before it
left, like any other commit (LG-A07): from a namespace and an owner (REQ-CL-002), the `std` package text, one `at`, and
four ULIDs `u1`…`u4`:
1. the genesis proposal (REQ-LG-006), without acts;
2. the `std` proposal (REQ-LG-007) for the session `std/<u1>`;
3. the namespace proposal: the entity `<namespace>/namespace` of type `std/namespace@1`, `base` 0, body
   `{"owner": <owner>, "writers": [{"login": <owner>}], "owner_acts": []}` (REQ-CT-002), and its session event;
4. the setup proposal: the entity `<namespace>/setup` of type `std/setup@1`, `base` 0, body
   `{"ports": {<port>: {"mode": "fixture", "memo": false}, …}}` for the five ports of `std/setup`; the `live` fact
   `<namespace>/<u4>` of type `std/live@1` with the body `{"of": {"subject": "<namespace>/setup@1"}, "key": {"id":
   "<namespace>/setup"}, "value": 1}` (TR-F05); and its session event.

The sessions of 3 and 4 are `<namespace>/<u2>` and `<namespace>/<u3>`; every session of 2–4 has the `at` given and the
body of the `std` session (`machine`, `init`); every intent's `by` is its session. Proposals 2–4 are applied with the
acts of the `init` adapter for the owner (REQ-AC-002), so their commits carry the owner's act and their records have
basis `derived`. `setup@1` puts every port on `fixture` with memoization off: no adapter block exists in S0 to serve a
port as `service` (PL-A05), and the owner changes `setup` by an owner act (CT-A02).

Implements: LG-G04, LG-A07, CT-N05, PL-A01, TR-F05

#### Scenario: The four commits of store init
<!-- id: SCN-LG-011 -->
- **WHEN** the four proposals of store init for the namespace `lattice`, the owner `Homasters-max`, the package of the
  repository, the `at` `1970-01-01T00:00:00.000Z` and the first four ULIDs of the counter ids (ST-T02) are applied in
  order on an empty ledger, the last three with the acts of `initActs("Homasters-max")`; then the whole sequence again
  on another empty ledger
- **THEN** each answers `commit`, with `seq` 1, 2, 3, 4; commit 1 is the genesis commit; commit 2 holds `std/live`,
  `std/namespace`, `std/setup` at `rev` 1 and the session event `std/<u1>`; commit 4 holds `lattice/setup` at `rev` 1,
  the event `lattice/<u4>` and the session event; commits 2–4 each have `acts`
  `[{"login":"Homasters-max","names":[<its proposal>],"ref":"store/lattice.json"}]`; `liveRevision` of the event
  records of the four commits for `lattice/setup` is `1`; the second sequence gives the same four commit texts

### Requirement: The basis of each record of a commit
<!-- id: REQ-LG-009 -->

The ledger module SHALL give `bases(commit)`: for every record of a commit, its basis by REQ-TR-001, where the session
is the body of the record of the commit whose `id` is the commit's `by` (the session event; `null` when there is none)
and `acted` is whether a record of its act record names the commit's `proposal` or the record's `id` (REQ-LG-003). The
basis is computed from the commit alone — its records and its act record —, so it is the same when the commit is read
back, re-applied (LG-P05 (2)) or rebuilt (LG-J02), and it never changes after the commit (TR-I04).

Implements: TR-B02, LG-A05, LG-A03

#### Scenario: Bases of the init commits and of acted and unacted records
<!-- id: SCN-LG-013 -->
- **WHEN** `bases` gets each commit of store init (SCN-LG-011); the commit of the fixture proposal of SCN-CL-003 applied
  on the init ledger without acts; the same with one act naming only `lattice/fx-a02`; and the commit
  of the fixture proposal whose session body has `kind` `agent` and `purpose` `work`, applied on the init ledger with
  an act naming its proposal hash
- **THEN** every record of commit 1 is `inferred`; every record of commits 2–4 is `derived`; every record of the
  unacted fixture commit is `inferred`; in the acted one `lattice/fx-a02` is `derived` and every other record
  `inferred`; every record of the agent commit is `asserted`

### Requirement: Opening a store checks its genesis chain
<!-- id: REQ-LG-010 -->

`openStore(stored, namespace)` SHALL open the ledger as `openLedger` does — the checks of LG-C04 only, REQ-CL-004
**Opening** — and then refuse a store whose history does not start with the four commits of store init (LG-G04) for
`namespace` — the namespace of the init configuration — on the chain kernel `0` knows (LG-G01). It checks every commit
in ledger order — `LG-G03` on each of them, the others on the commit at their position (the first, second, third and
fourth commit, whatever their `seq`) —, and the first commit that fails a check is refused, naming the first rule it
fails in the order of this list and the `seq` of that commit:
- `LG-G03` — the commit's `kernel` is not `"0"` (no transition commit is known, LT-01);
- `LG-G01` — the first commit's commit hash is not the genesis hash;
- `LG-G02` — the second commit is not a load of the `std` package by the conditions of its exemption (REQ-LG-002): it
  holds records other than its entity records and its session event (the record whose `id` is the commit's `by`);
  the session body does not have `kind` `machine` and `purpose` `init`; or its entity records, as `{"id", "type",
  "body"}` in record order, do not have the package hash of the `std` package (REQ-LG-007);
- `LG-G04` — the third commit does not hold, beside its session event, exactly the entity `<namespace>/namespace` at
  `rev` 1 of type `std/namespace@1` (CT-N05); or the fourth commit does not hold, beside its session event, exactly
  the entity `<namespace>/setup` at `rev` 1 of type `std/setup@1` and one event of type `std/live@1` (PL-A01, TR-F05);
- `LG-G04` — the ledger holds fewer than four commits, after the commits it holds passed: the `seq` named is one more
  than the `seq` of its last commit (`1` for an empty ledger), and the message says how to recover: remove `store/`
  and run `lattice init` again.

So a store opens only when store init finished: an empty ledger (written by `init` before this Change), a ledger cut
short by a failed `init` (REQ-CL-002) and a store whose namespace commit does not match its init configuration are
refused, and `apply` never writes a commit in the place of an init commit. `openLedger` itself is unchanged: it opens
ledgers that are not stores, such as the ledgers of rule fixtures (REQ-AR-011), L1 (REQ-LG-003) and the ledgers store
init builds in memory (REQ-CL-002). `apply` and `export`, the commands that read the ledger of a project store, run
both (REQ-CL-004, **Opening a store**); `import-md` reads no ledger. `openStore` reads no acts, and it checks commits
3 and 4 by `id`, `rev` and `type` only — not their bodies, sessions or acts, nor the `owner` of `store/lattice.json`,
which is the owner of the namespace at init only (the owner changes later by an owner act, CT-A02).

Implements: LG-G01, LG-G02, LG-G03, LG-G04, CT-N05

#### Scenario: A store outside the genesis chain is refused
<!-- id: SCN-LG-014 -->
- **WHEN** `openStore` with the namespace `lattice` gets the ledger of store init (SCN-LG-011); that ledger followed by
  the commit of the fixture proposal of SCN-CL-003; an empty ledger; L1 (REQ-LG-003); the genesis commit followed by
  the commit of the fixture proposal applied on it; the genesis commit followed by a commit of the `std` package whose
  session body has `purpose` `work`, its hash chain kept; the ledger of store init with commit 4 rebuilt with `kernel`
  `"1"` and its hash chain kept; the first two commits of store init; the first three; and, with the namespace
  `other`, the ledger of store init
- **THEN** the first two open; the empty ledger is refused naming `LG-G04` and `seq` 1; L1 `LG-G01` and `seq` 1; the
  next two `LG-G02` and `seq` 2; the `kernel` `"1"` ledger `LG-G03` and `seq` 4; the first two commits `LG-G04` and
  `seq` 3; the first three `LG-G04` and `seq` 4; the namespace `other` `LG-G04` and `seq` 3; `openLedger` opens every
  one of them
