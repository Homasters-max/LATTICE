# Spec Delta

## ADDED Requirements

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

The closed list of rule IDs (REQ-AR-011) SHALL be exactly `LG-C03`, `LG-C07`, `LG-P01`, `LG-P02`. A Change that adds a
rule to apply changes this list and adds the rule's fixture.

`LG-P01` is found by reading the proposal (REQ-LG-001). Unless it answers `existing` (REQ-LG-003), apply SHALL find,
against one state — the latest-revision projection (LG-J01) of the opened ledger (LG-J03) and the whole proposal —,
every rejection of these rules, never only the first:

| Rule | When | `intent` | `path` | `expected` | `got` | Also |
|---|---|---|---|---|---|---|
| `LG-C07` | an intent names an `id` that an intent earlier in the text already names — one rejection per such later intent | that `id` | `/intents/<i>/id` of the later intent | `null` | `null` | `with` that `id`; `differs` the paths where the intents naming that `id` differ |
| `LG-P02` | an entity intent's `base` differs from the latest revision of its `id` in the projection (`0` when the `id` has none) | the intent's `id` | `/intents/<i>/base` | the latest revision | the `base` | — |

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

Implements: LG-A02, LG-A03, LG-C07, LG-P02, LG-C03, LG-J03

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
- **WHEN** the list of rule IDs exported by the ledger module is read
- **THEN** it is exactly `LG-C03`, `LG-C07`, `LG-P01`, `LG-P02`

### Requirement: Apply answers a commit, a no-op, an existing commit or rejections
<!-- id: REQ-LG-003 -->

Apply SHALL be a pure function of the opened ledger and a proposal that passed its form (ST-S03, LG-A01). It assigns
only `seq`, `rev` and `hash` (LG-P01).

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
2. **`rejected`**: the rejections of `LG-C07` and `LG-P02` (REQ-LG-002), when there is at least one.
3. **`no-op` (LG-C05)**: when the session event is the only held intent.
4. **`commit` (LG-C01, LG-C02)**: otherwise one commit, built on the tail of the opened ledger: `{"seq", "prev",
   "kernel", "base", "proposal", "by", "at", "records"}` with `seq` one more than the `seq` of the tail (`1` for an
   empty ledger); `prev` the commit hash of the tail or `null`; `kernel` `"0"` (LG-G05); `base` the `seq` of the tail
   or `0`; `proposal` the hash of the held intents; `by` and `at` those of the session event; `records` one record per
   held intent, in canonical order (REQ-LG-001). An entity record is `{"id", "rev", "type", "hash", "by", "at",
   "body"}` with `rev` = `base` + 1, `hash` the record hash and `at` the `at` of the commit; an event record is `{"id",
   "type", "by", "at", "body"}` (OM-E01). So the `proposal` of a commit is computed from its records alone (LG-P05).
   Apply also gives the commit's text: its canonical JSON (RFC 8785).

Hashes are kernel hashes as in REQ-LG-001: the **commit hash** is of type id `core/commit` over the commit object; the
**record hash** of an entity record is of its type without the `@n` suffix over its body (OM-H01 over `type@n` comes
with s0-kernel #55, design I-1 of `s0-skeleton`).

Implements: LG-A01, LG-C01, LG-C02, LG-C05, LG-C08, OM-H03, LG-P01, LG-P04

#### Scenario: Unchanged entities are a no-op, a changed one a commit of only itself
<!-- id: SCN-LG-003 -->
- **WHEN** after the commit of SCN-CL-005 apply runs on a proposal of a new session event and the four entity intents
  of that commit, each with `base` 1, `by` the new session's `id` and its type and body unchanged; then on the same
  proposal with the body of `lattice/fx-a02` changed; then on the first proposal with the type of `lattice/fx-a01`
  changed to `lattice/table.rule@2` and its body unchanged; then on a proposal holding only a new session event
- **THEN** the first answers `no-op`; the second a commit with `seq` 2 and `base` 1 whose records are
  `lattice/fx-a02` at `rev` 2 and the session event, and whose `proposal` is the hash of those two intents; the third
  a commit whose records are `lattice/fx-a01` at `rev` 2 of type `lattice/table.rule@2` and the session event (OM-H01:
  another type revision is never a no-op); the fourth `no-op`

#### Scenario: A proposal already in the ledger answers its commit
<!-- id: SCN-LG-004 -->
- **WHEN** apply runs with the fixture proposal of SCN-CL-003 on the ledger of SCN-CL-005, then on that ledger after
  the commit of `lattice/fx-a02` at `rev` 2 of SCN-CL-009; and the second proposal of SCN-LG-003 runs again on the
  ledger holding its commit, then on that ledger after one more commit writes `lattice/fx-a01` at `rev` 2
- **THEN** the first two answer `existing` with `seq` 1 and find no rejection `LG-P02`; the third answers `existing`
  with `seq` 2; the last answers rejections `LG-P02` for `lattice/fx-a01` and `lattice/fx-a02`

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

A permutation test SHALL prove it on these cases, each a proposal and the ledger it is applied to: every rule fixture
(REQ-AR-011), its commit checked against `ledger.jsonl` followed by `moved.jsonl` when the folder has one; the fixture
proposal of SCN-CL-003 on an empty ledger and on the ledger of SCN-CL-005; each proposal of SCN-LG-002 on an empty
ledger; each proposal of SCN-LG-003 on the ledger of SCN-CL-005. It runs every permutation of a proposal of at most 7
intents, otherwise the reverse order, every rotation and 50 permutations drawn from a fixed seed.

Implements: LG-C07

#### Scenario: Every permutation of the intents gives the same result
<!-- id: SCN-LG-006 -->
- **WHEN** the permutation test runs on the cases of REQ-LG-005
- **THEN** every permutation of every proposal gives the result of the proposal as written
