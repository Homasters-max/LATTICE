# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/ledger/spec.md`, `specs/cli/spec.md` and
`specs/architecture/spec.md` of this Change. Today (after `s0-skeleton`, #54):
- `src/ledger/proposal.ts` — `parseProposal` (the form and its `LG-P01` rejections), `orderedIntents` (canonical
  order), `proposalHash`, `proposalText`.
- `src/ledger/apply.ts` — `apply(ledger, proposal)` answers `commit` or `rejected`; it finds `LG-C07` (an `id` named by
  an earlier intent) and `LG-P02` (expected revision) in one pass, then builds the commit.
- `src/ledger/rules.ts` — `REJECTION_RULES = ["LG-C07", "LG-P01", "LG-P02"]`, `Rejection`, the only constructor
  `reject`, `sortRejections`.
- `src/ledger/commit.ts` — `openLedger(stored)` verifies the chain (LG-C04) and gives `Ledger = { tail, view }`;
  `commitHash`, `recordHash` (over the type without `@n`, design I-1 of #54).
- `src/assembly/index.ts` — the `apply` operation: reads the proposal file, opens the store, applies, appends with
  `store.append(commit, after)`; a `moved` answer is a code-2 refusal naming LG-C03.
- `test/architecture/rules.test.ts` — SCN-AR-017 asserts the list is exactly `LG-C07, LG-P01, LG-P02` and runs every
  folder of `test/fixtures/rules/`.
- The semantics of apply are written in REQ-CL-004 of the spec `cli`; there is no spec `ledger`.

## Goals / Non-Goals

**Goals:**
- Every check of #56 rejects with its rule ID on its own fixture (LG-A02); the permutation test passes in CI (LG-C07).
- The apply semantics live in the spec of the ledger AREA, so the next apply checks (#82) need only `LG`.
- No change to a file the skeleton owns (SL-T08): the module matrix, the CLI entry and table, `package.json`, the port
  interfaces.

**Non-Goals:**
- Everything proposal.md, Non-goals, names: the checks that read types or fact types (#82), store hardening (#57),
  OM-H01 (#55).
- Performance: the proposal index and the projection are rebuilt in memory on every command (LG-J04 allows it).

## Decisions

### D-1. Apply moves into the spec `ledger`; AREAs `LG`, `AR`, `CL`

REQ-CL-004 is split: the proposal form, the rejections, the outcomes, the commit form and the hashes move verbatim (with
the new rules) into REQ-LG-001…005; REQ-CL-004 keeps the command — the proposal file, opening the ledger (LG-C04), and
what it writes, prints and removes on each outcome. Its **Proposal** paragraph stays as a pointer, so the reference of
REQ-CL-003 ("REQ-CL-004, **Proposal**") still resolves without touching REQ-CL-003. The CL scenarios keep their ids and
tests; SCN-CL-007 and SCN-CL-011 change, SCN-CL-012 and SCN-CL-013 are new.

REQ-AR-011 stops pinning the list: the closed list is enumerated in REQ-LG-002 and checked by SCN-LG-007, REQ-AR-011
refers to it, and the fixture coverage test keeps code and folders equal (spec review 1, F-2). So a Change that adds a
rule to apply — #82, and #59 if it adds TR-B02 or CT-N03 as apply checks (LG-A03) — holds `LG`, not `AR`.

Held AREAs: `LG`, `AR`, `CL` — the maintainer's decision of 2026-10-02 (row `I-2`), posted on umbrella #44.

Rejected: only adding to the spec `cli` — every later apply check would hold `CL`, the most contested AREA of S0 (#58
I-21, #59 `init`); a new `ledger` spec that adds rules while REQ-CL-004 keeps its table — two tables of the same
rejections, and REQ-CL-004's "a commit or rejections" would contradict `no-op` and `existing`.

### D-2. The ledger API

```ts
// rules.ts
export const REJECTION_RULES = ["LG-C03", "LG-C07", "LG-P01", "LG-P02"] as const;
export type Rejection = {
  readonly intent: string | null; readonly rule: RuleId; readonly message: string; readonly path: string;
  readonly expected: unknown; readonly got: unknown;
  readonly with?: string; readonly differs?: readonly string[];   // a duplicate only (LG-A02)
};
export function reject(rule, intent, path, message, expected?, got?): Rejection;          // unchanged
export function duplicate(rule, intent, path, message, withId: string, differs: readonly string[]): Rejection;

// apply.ts
export type Applied =
  | { readonly outcome: "commit"; readonly commit: Commit; readonly text: string }
  | { readonly outcome: "existing"; readonly seq: number }
  | { readonly outcome: "no-op" }
  | { readonly outcome: "rejected"; readonly rejections: readonly Rejection[] };
export function apply(ledger: Ledger, proposal: Proposal): Applied;
export type TailCheck =
  | { readonly outcome: "clear" }
  | { readonly outcome: "existing"; readonly seq: number }
  | { readonly outcome: "rejected"; readonly rejections: readonly [Rejection] };          // LG-C03
export function checkTail(ledger: Ledger, commit: Commit): TailCheck;

// commit.ts
export type Ledger = { readonly tail; readonly view: ReadView; readonly proposals: ReadonlyMap<Hash, number> };

// differs.ts
export function differs(values: readonly unknown[]): readonly string[];                 // JSON pointers, sorted
```

- `Ledger.proposals` maps the `proposal` hash of every commit to the `seq` of the first commit holding it; `openLedger`
  fills it in the same pass that verifies the chain. It lives in `commit.ts`, not under `projections/`, which
  s0-projections (#60) grows.
- `differs` is pure and lives in its own file, because #82 reuses it for fact keys and uniqueness collisions.
- `index.ts` exports `checkTail`, `Applied`, `TailCheck` and `differs` next to the existing exports.
- The hash of a list of intents is `hash("core/proposal", orderedIntents(list))`, the same function `proposalHash` uses
  over all intents; `apply` calls it over the held intents (D-4). `proposal.ts` is not changed.

Rejected: `apply` appending through the `store` port itself (`applyTo(store, proposal)`) — apply must stay pure
(ST-S03), and the `store` port is the skeleton's file; extra fields of a duplicate packed into `expected` / `got` —
LG-A02 names them as their own facts, and `expected` / `got` keep one meaning for every rule.

### D-3. Duplicates and the permutation equivalence

- `apply` groups intents by `id` in text order; for an `id` named by k ≥ 2 intents it rejects the 2nd…k-th, each with
  `with` = that `id` and `differs` = `differs(<the k intents>)`. `differs` walks the k values together (REQ-LG-002):
  equal canonical JSON → nothing; all plain objects → the union of keys in UTF-16 order, a key missing from one lists
  its path; all lists of one length → by position; otherwise the path itself. Pointers are escaped (`~0`, `~1`).
- Which of the k intents is rejected depends on the text order, but every rejected one has the same `intent`, `rule`,
  `with`, `differs` and in-intent path `/id`. So REQ-LG-005 compares rejections without `message` and without the
  `/intents/<i>` prefix of `path`: the prefix is a position in the text, the only part a permutation may change.
- `LG-P02` is still checked on every entity intent, duplicates included, so a duplicate with a stale `base` gives both
  rejections.

Rejected: rejecting every intent of a duplicated `id`, which would make the rejections invariant without stripping the
prefix — LG-C07 says "a second one is rejected", and the first stays as the reference `with` points to; paths in canonical
order instead of text order — a hand-edited proposal would point to the wrong place in its own file.

### D-4. No-op and held intents (LG-C05, OM-H03, LG-P04)

- An entity intent is a no-op when `view.get(id)` has `rev === intent.base`, `type === intent.type` and `hash ===
  recordHash(intent.type, intent.body)`; `by` is not compared. The type is compared too, because the record hash of #54
  omits `@n` (design I-1 of #54): without it `type@1 → type@2` with the same body would wrongly be a no-op (OM-H01).
  `rev === base` is part of the definition, so a stale `base` with an unchanged body is not a no-op but `LG-P02` — the
  expected revision is the concurrency guarantee (LG-P02), and SCN-CL-006 already rejects a second import.
- The held intents are the intents that are not no-ops. The commit holds exactly them as records (LG-P04: "the commit
  holds the intents in full") and its `proposal` is the hash of the held intents, so the header is computed from the
  records alone and re-applying the intents of a commit to its `base` gives the same bytes (LG-P05 (2)). For a
  proposal without no-ops this is the proposal hash, as in #54.
- The session event is always held; in S0 no other event can be a no-op (TR-F07 is #82). A proposal whose only held
  intent is the session event is a `no-op` — an empty commit is never written (LG-C05).
- Classifying no-ops needs only the projection, so `apply` does it first: re-apply (D-5) needs the held intents.
- In S0 a no-op comes only from a hand-written or tool-written proposal with `base` ≥ 1: `import-md` always writes
  `base` 0, so re-importing an unchanged `md` meets `LG-P02` (SCN-CL-006), never a no-op (spec review 2, F-8).

Rejected (spec review 1, F-1): hashing every intent while the records hold only the held ones — the header could not be
recomputed from the commit (LG-P04, LG-P05 (2)); writing no-op intents as records that keep their `rev` — a revision
recorded twice, against OM-H03 and OM-E01.

### D-5. Re-apply (LG-C08)

`apply` looks the hash of the held intents up in `ledger.proposals` before the rejections and answers `existing` with
that `seq`. After a crash between append and removal, the proposal file is still there: its intents that were no-ops
are still no-ops, the ones the commit wrote are not (their `rev` moved past `base`), so the held intents — and their
hash — are those of the commit. The CLI prints the answer exactly as the first apply did
(`{"outcome":"commit","seq":<seq>}`) and removes the proposal file. A match is the same session event among the held
intents, so a different proposal cannot hit it. A `no-op` leaves no commit, so re-applying a no-op proposal is decided
again against the current tail.

The limit (spec review 2, F-1): when, between the crash and the re-run, another commit writes an entity that was a
no-op for the proposal, that intent is held again, the hash matches no commit and the re-run answers `LG-P02`; the
commit is safe, only the proposal file is left for the user to remove. REQ-LG-003 states it and SCN-LG-004 pins it.
Rejected: finding the commit by the proposal's session event and recomputing the held intents against the ledger at
that commit's `base` — it needs a projection at an earlier `seq`, which the ledger does not keep (LG-J01 is #60), for
a case that needs both a crash and a concurrent write of the same entity.

### D-6. Tail (LG-C03)

- `checkTail(ledger, commit)` is pure: `existing` when `ledger.proposals` holds `commit.proposal`; `clear` when
  `commit.base === (ledger.tail?.seq ?? 0)` and `commit.prev === (ledger.tail?.hash ?? null)`; otherwise the rejection
  `{intent: null, rule: "LG-C03", path: "", expected: {seq: commit.base, hash: commit.prev}, got: {seq, hash} of the
  tail}`. The hash is compared too, so a tail replaced at the same `seq` cannot pass `checkTail` (LG-C04, spec review
  2, F-6). The command reaches `checkTail` only after the store answers `moved`, which compares the `seq` alone, so a
  tail replaced at the same `seq` outside apply is not seen at the append; the next opening refuses the broken chain
  (LG-C04, I-14). The `existing` answer covers two writers applying the same proposal: the one that loses the
  race answers the commit the other wrote, as LG-C08 asks (spec review 1, F-12).
- Removing the proposal file treats `ENOENT` as removed: the winner of that race has already removed it (spec review
  2, F-2, SCN-CL-014).
- `assembly` appends with `store.append({seq, text}, commit.base)` as today; on `moved` it reads the store again,
  `openLedger` (a broken ledger is a code-2 refusal, as on the first open) and acts on `checkTail`: `existing` as the
  outcome `existing`, `rejected` (exit 1), `clear` — `moved` on an unmoved tail — a store fault, code 2 naming the
  store.
- No retry inside the command: LG-C03 leaves it to the caller, and a retry would reapply on a tail the user has not seen.
- The `store` port is unchanged; the memory adapter and its "two writers" test come with #57 (LG-S02).

### D-7. The permutation test (`test/ledger/permutation.test.ts`)

- Cases (REQ-LG-005): every folder of `test/fixtures/rules/` (its ledger, proposal, and `moved.jsonl` when present);
  the fixture proposal of SCN-CL-003 on an empty ledger and on the ledger of SCN-CL-005; the proposals of SCN-LG-002 on
  an empty ledger; the proposals of SCN-LG-003 on the ledger of SCN-CL-005 — built in the test from the fixture `md`
  with `clock-fixed` and `ids-counter`.
- For each case it computes the result of the text as written: `parseProposal` → `apply` → `checkTail` (against
  `ledger.jsonl` + `moved.jsonl` when present). Then for every permutation (Heap's algorithm for ≤ 7 intents; otherwise
  the reverse, every rotation and 50 Fisher–Yates permutations from a fixed-seed `mulberry32` written in the test)
  it re-serialises `{"intents": <permuted>}` with `JSON.stringify` and compares: the outcome, the commit text, the
  `existing` `seq`, the `checkTail` answer, and the rejections as sorted lists of their canonical JSON without
  `message` and with `path` stripped of `^/intents/\d+`.
- A permutation of a text that fails `LG-P01` at the top level (not a list) is the text itself.

### D-8. Fixtures

| Folder | `ledger.jsonl` | `proposal.json` | `moved.jsonl` | `expected.json` |
|---|---|---|---|---|
| `LG-C07` (changed) | unchanged | unchanged | — | the one rejection plus `with` `"lattice/fx-a01"` and `differs` `[]` |
| `LG-C03` (new) | empty | the fixture proposal of SCN-CL-003 | one commit of another proposal (the fixture `md` imported under another session), written by this Change's apply | `[{intent: null, rule: "LG-C03", path: "", expected: {seq: 0, hash: null}, got: {seq: 1, hash: <its commit hash>}}]` |
| `LG-P01`, `LG-P02` | unchanged | unchanged | — | unchanged |

`no-op` and `existing` are outcomes, not rejections: no rule fixture; SCN-LG-003, SCN-LG-004, SCN-CL-012 and
SCN-CL-013 cover them.

### D-9. Tests and the scope of the implement Run

| Path | Proves |
|---|---|
| `test/ledger/cases.ts` (new) | not a test: the fixture `md` imported in process under a numbered session, ledgers from commit texts, `applyText` — shared by the ledger, permutation and CLI tests (I-18) |
| `test/ledger/apply.test.ts` (new) | SCN-LG-001…005, SCN-LG-007 — `parseProposal`, `apply`, `checkTail`, `differs`, `REJECTION_RULES` in process |
| `test/ledger/permutation.test.ts` (new) | SCN-LG-006 (D-7) |
| `test/architecture/rules.test.ts` (changed) | SCN-AR-017 — no enumerated list; `moved.jsonl` for LG-C03 |
| `test/fixtures/rules/LG-C07/expected.json`, `test/fixtures/rules/LG-C03/**` | SCN-AR-017 (D-8) |
| `test/cli/apply.test.ts` (changed) | SCN-CL-007 (`with`, `differs`), SCN-CL-011 (a store that gains a commit), SCN-CL-012, SCN-CL-013, SCN-CL-014 (a store whose other writer appends the same commit and removes the file); SCN-CL-005, 006, 008 unchanged |

`implement` Run scope: `src/ledger/apply.ts,src/ledger/rules.ts,src/ledger/commit.ts,src/ledger/index.ts,
src/ledger/differs.ts,src/assembly/index.ts,test/ledger/**,test/architecture/rules.test.ts,test/cli/apply.test.ts,
test/fixtures/rules/**,openspec/changes/s0-apply-checks/**`. `src/ledger/proposal.ts`, `src/ledger/projections/**`,
`src/ledger/ports/**`, `src/kernel/**`, the CLI files and `package.json` stay out of it.

## Decisions on implementation (I-N)

| ID | Decision | Why | By |
|---|---|---|---|
| I-1 | Uniqueness OM-D01 / OM-D03, pinned targets OM-R03, one intent per fact key (LG-C07) and the fact no-op TR-F07 move to #82 `s0-apply-typed-checks`; #56 keeps LG-P02, LG-C03, LG-C07 per entity `id` with the permutation test, LG-C05 / OM-H03 for entities, LG-C08 and LG-A02. | They read the `unique`, reference and `key` fields of a type (OM-T02, OM-R02, TR-F01); no type exists in the ledger before #55 and #59, and `$ref` markers are not taken (NX-15). | the maintainer, 2026-10-02 (session of #56; issue #56 edited, umbrella #44 comment 5947360465) |
| I-2 | #56 holds `LG` + `AR` + `CL` (D-1). | REQ-AR-011 pins the rule list; REQ-CL-001 and REQ-CL-004 describe the outcomes of `apply`. | the maintainer, 2026-10-02 (same) |
| I-3 | A commit holds only its held intents and its `proposal` is their hash; LG-C08 looks up the hash of the held intents; a no-op needs `rev` = `base` (REQ-LG-003, D-4, D-5). | Spec review 1 (`EVID-01M3XRYWC0MGBDTB6RF5P4MGJZ`), F-1 (MAJOR): with a partial no-op, a hash over every intent could not be recomputed from the commit (LG-P04, LG-P05 (2)); none of the review's three options kept LG-C08 for a crash after a partial no-op. | approval of the spec-PR |
| I-4 | The closed rule list is enumerated in REQ-LG-002 (SCN-LG-007); REQ-AR-011 refers to it, demands a non-empty `expected.json` and ledgers that open (LG-C04). | Review 1, F-2 (MAJOR), F-6, F-7: no spec pinned the list, so an extra rule with a folder passed. | approval of the spec-PR |
| I-5 | REQ-CL-004 renamed "apply turns a proposal into a commit, a no-op or rejections"; REQ-CL-001 counts rejections of reading and of the tail check under code 1 and the store answering `moved` on an unmoved tail under code 2; REQ-LG-002 splits the rejections of apply from that of the tail check. | Review 1, F-3, F-4, F-11. | approval of the spec-PR |
| I-6 | The check of the tail answers `existing` when the ledger already holds the commit's `proposal` (REQ-LG-004, D-6). | Review 1, F-12 (INFO): two writers of one proposal — the loser answered `LG-C03` where LG-C08 asks for the commit. | approval of the spec-PR |
| I-7 | Wording: the hash is order-independent for intents with distinct `id`s (REQ-LG-001); SCN-LG-001 names the fixture proposal in every case; SCN-LG-003 and SCN-CL-012 give `by` the new session and say `by` is not compared; REQ-LG-005 lists its cases and the permutation of a text without a list. | Review 1, F-5, F-8, F-9, F-10. | approval of the spec-PR |
| I-8 | Re-apply after a crash answers the commit only while no intent that was a no-op for the proposal has been written since; otherwise `LG-P02`. Stated in REQ-LG-003 and REQ-CL-004, pinned in SCN-LG-004 (D-5). | Spec review 2 (`EVID-01M3XSNM19EFAF2B153RTHCHNH`), F-1 (MAJOR): option 1 of its decision D-1; option 2 needs a projection at an earlier `seq`, option 3 is what I-3 rejected. | approval of the spec-PR |
| I-9 | A proposal file already gone at removal counts as removed; SCN-CL-014 for two writers of one proposal (D-6). | Review 2, F-2 (MAJOR): the loser of the race exited with code 2 on a missing file. | approval of the spec-PR |
| I-10 | The "proposal hash" (all intents, names a proposal file) is told apart from the commit's `proposal` (held intents, LG-C02); `proposal.md` No-op and Re-apply bullets say `rev` = `base` and held intents. | Review 2, F-3, F-4. | approval of the spec-PR |
| I-11 | Apply finds the rejections only when it does not answer `existing` (REQ-LG-002). | Review 2, F-5. | approval of the spec-PR |
| I-12 | The tail check compares the tail's hash with the commit's `prev` as well as its `seq`; `LG-C03` gives `expected` and `got` as `{seq, hash}` (REQ-LG-002, REQ-LG-004, SCN-LG-005, SCN-CL-011). | Review 2, F-6: a tail replaced at the same `seq` passed and the append broke the chain (LG-C04). | approval of the spec-PR |
| I-13 | SCN-LG-003 adds a type change with an unchanged body, which is a commit, not a no-op. | Review 2, F-7: an implementation that skipped the type passed every scenario. | approval of the spec-PR |
| I-14 | REQ-LG-004 and REQ-CL-004 say the writer sees a moved tail only through the store's `moved`, which compares the `seq`; a tail replaced at the same `seq` outside apply is refused at the next opening (LG-C04); D-6 narrows its claim to `checkTail`. | Spec review 3 (`EVID-01M3XT5RCPWN2YENNK0SBDT4XJ`), F-1. | approval of spec-PR #87 (planned there as I-14) |
| I-15 | The Tail bullet of `proposal.md` names the `existing` answer and the comparison with `prev`. `proposal.md` is outside the `write_scope` of `implement`: a human edit, asked in the impl-PR. | Review 3, F-2. | approval of spec-PR #87 (planned as I-15) |
| I-16 | SCN-AR-017 runs a copy of `LG-P02` with an empty `expected.json` and one whose ledger does not open; both fail naming the folder. | Review 3, F-3: REQ-AR-011 gained both failures in I-4 without a scenario. | approval of spec-PR #87 (planned as I-16) |
| I-17 | SCN-LG-003 says "the first proposal" in its type-change case. | Review 3, F-4. | approval of spec-PR #87 (planned as I-17) |
| I-18 | A test helper `test/ledger/cases.ts` builds the proposals and ledgers of the ledger, permutation and CLI tests in process; SCN-CL-011 also covers `moved` on an unmoved tail (code 2); the SCN-CL-008 test changes the body of its second commit, which would otherwise be a no-op. Spec unchanged. | Implementation: one source of the fixture proposals instead of three copies; the skeleton test wrote an unchanged body at `base` 1. | implementation, this impl-PR |
| I-19 | Implementation review: `Ledger.proposals` keyed by the branded `Hash` (D-2); one `settled` step in `assembly` removes the proposal file for every final outcome and names a failed removal "cannot remove"; the copies of test helpers moved into `test/ledger/cases.ts`; SCN-AR-017 runs the folder scan itself on a temporary rules folder. Kept: the signature of `duplicate` and the export of `differs` (D-2, reuse by #82). Spec unchanged. | `code-review` of this impl-PR — Standards S-1…S-4, Spec P-3. | implementation, this impl-PR |

## Risks / Trade-offs

- [`CL` is held until the archive of #56] → #59 (`init` writing genesis, REQ-CL-002) and the `I-21` alternative of #58
  (REQ-CL-003) wait; posted on #44. The CL delta is limited to REQ-CL-001 and REQ-CL-004.
- [`src/assembly/index.ts` is a source path other wave-2 Changes may need (#57, #59)] → #56 changes only the `apply`
  operation; a Change that needs the file coordinates on #44 before its impl-PR.
- [`commit.ts` also holds `recordHash`, which #55 changes for OM-H01] → #56 adds only the `proposals` index to
  `openLedger`; the merge is textual and the store is disposable (LG-G05).
- [The no-op compares the record hash of #54, without `@n`] → the type is compared as well (D-4); #55 changes
  `recordHash` and the no-op follows it.
- [The rejections of a permuted proposal differ in the position prefix of `path`] → REQ-LG-005 states the equivalence
  exactly (D-3); the rest of every rejection must be equal.

## Migration Plan

None: the store is disposable before the switch (LG-G05). The rule fixture `LG-C07/expected.json` gains two fields.
At archive the spec `ledger` is created, REQ-CL-001, REQ-CL-004 and REQ-AR-011 are replaced by their modified text.
