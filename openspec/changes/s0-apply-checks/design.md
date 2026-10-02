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

REQ-AR-011 stops pinning the list in its scenario: the closed list stays in `REJECTION_RULES`, each rule is defined by
the requirement that names it, and the fixture coverage test keeps code and folders equal. So #82 and #59, which add
rules, do not hold `AR`.

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
export function checkTail(ledger: Ledger, commit: Commit): Rejection | null;            // LG-C03

// commit.ts
export type Ledger = { readonly tail; readonly view: ReadView; readonly proposals: ReadonlyMap<Hash, number> };

// differs.ts
export function differs(values: readonly unknown[]): readonly string[];                 // JSON pointers, sorted
```

- `Ledger.proposals` maps the `proposal` hash of every commit to the `seq` of the first commit holding it; `openLedger`
  fills it in the same pass that verifies the chain. It lives in `commit.ts`, not under `projections/`, which
  s0-projections (#60) grows.
- `differs` is pure and lives in its own file, because #82 reuses it for fact keys and uniqueness collisions.
- `index.ts` exports `checkTail`, `Applied` and `differs` next to the existing exports.

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

### D-4. No-op (LG-C05, OM-H03)

- Order: re-apply, then rejections, then no-op (REQ-LG-003). A stale `base` with an unchanged body is `LG-P02`, not a
  no-op: the expected revision is the concurrency guarantee (LG-P02), and SCN-CL-006 already rejects a second import.
- An entity intent is a no-op when `view.get(id)` exists (so `base` ≥ 1 after LG-P02) with `type === intent.type` and
  `hash === recordHash(intent.type, intent.body)`. The type is compared too, because the record hash of #54 omits `@n`
  (design I-1 of #54): without it `type@1 → type@2` with the same body would wrongly be a no-op (OM-H01).
- The session event is not counted; in S0 no other event can be a no-op (TR-F07 is #82). A proposal of only a session
  event is a `no-op` — an empty commit is never written (LG-C05).
- In a commit, a no-op intent gives no record; the `proposal` hash still covers every intent, so re-applying the same
  proposal to the same `base` gives the same bytes (LG-P05 (2)).

### D-5. Re-apply (LG-C08)

`apply` looks the proposal hash up in `ledger.proposals` before any other check and answers `existing` with that `seq`.
The CLI prints it exactly as the first apply did (`{"outcome":"commit","seq":<seq>}`) and removes the proposal file, so
a crash between append and removal (LG-P04) is repaired by running `apply` again. A `no-op` leaves no commit, so
re-applying a no-op proposal is decided again against the current tail.

### D-6. Tail (LG-C03)

- `checkTail(ledger, commit)` is pure: `commit.base` against `ledger.tail?.seq ?? 0`; the rejection is `{intent: null,
  rule: "LG-C03", path: "", expected: commit.base, got: <tail seq>}`.
- `assembly` appends with `store.append({seq, text}, commit.base)` as today; on `moved` it reads the store again,
  `openLedger` (a broken ledger is a code-2 refusal, as on the first open), and returns `checkTail`'s rejection as
  `rejected` (exit 1). A `moved` answer on an unmoved tail is a store fault: code 2 naming the store.
- No retry inside the command: LG-C03 leaves it to the caller, and a retry would reapply on a tail the user has not seen.
- The `store` port is unchanged; the memory adapter and its "two writers" test come with #57 (LG-S02).

### D-7. The permutation test (`test/ledger/permutation.test.ts`)

- Cases: every folder of `test/fixtures/rules/` (its ledger, proposal, and `moved.jsonl` when present), and the
  proposals and ledgers of SCN-LG-001…005, built in the test from the fixture `md` with `clock-fixed` and
  `ids-counter`.
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
| `LG-C03` (new) | empty | the fixture proposal of SCN-CL-003 | one commit of another proposal (the fixture `md` imported under another session), written by this Change's apply | `[{intent: null, rule: "LG-C03", path: "", expected: 0, got: 1}]` |
| `LG-P01`, `LG-P02` | unchanged | unchanged | — | unchanged |

`no-op` and `existing` are outcomes, not rejections: no rule fixture; SCN-LG-003, SCN-LG-004, SCN-CL-012 and
SCN-CL-013 cover them.

### D-9. Tests and the scope of the implement Run

| Path | Proves |
|---|---|
| `test/ledger/apply.test.ts` (new) | SCN-LG-001…005 — `parseProposal`, `apply`, `checkTail`, `differs` in process |
| `test/ledger/permutation.test.ts` (new) | SCN-LG-006 (D-7) |
| `test/architecture/rules.test.ts` (changed) | SCN-AR-017 — no enumerated list; `moved.jsonl` for LG-C03 |
| `test/fixtures/rules/LG-C07/expected.json`, `test/fixtures/rules/LG-C03/**` | SCN-AR-017 (D-8) |
| `test/cli/apply.test.ts` (changed) | SCN-CL-007 (`with`, `differs`), SCN-CL-011 (a store that gains a commit), SCN-CL-012, SCN-CL-013; SCN-CL-005, 006, 008 unchanged |

`implement` Run scope: `src/ledger/apply.ts,src/ledger/rules.ts,src/ledger/commit.ts,src/ledger/index.ts,
src/ledger/differs.ts,src/assembly/index.ts,test/ledger/**,test/architecture/rules.test.ts,test/cli/apply.test.ts,
test/fixtures/rules/**,openspec/changes/s0-apply-checks/**`. `src/ledger/proposal.ts`, `src/ledger/projections/**`,
`src/ledger/ports/**`, `src/kernel/**`, the CLI files and `package.json` stay out of it.

## Decisions on implementation (I-N)

| ID | Decision | Why | By |
|---|---|---|---|
| I-1 | Uniqueness OM-D01 / OM-D03, pinned targets OM-R03, one intent per fact key (LG-C07) and the fact no-op TR-F07 move to #82 `s0-apply-typed-checks`; #56 keeps LG-P02, LG-C03, LG-C07 per entity `id` with the permutation test, LG-C05 / OM-H03 for entities, LG-C08 and LG-A02. | They read the `unique`, reference and `key` fields of a type (OM-T02, OM-R02, TR-F01); no type exists in the ledger before #55 and #59, and `$ref` markers are not taken (NX-15). | the maintainer, 2026-10-02 (session of #56; issue #56 edited, umbrella #44 comment 5947360465) |
| I-2 | #56 holds `LG` + `AR` + `CL` (D-1). | REQ-AR-011 pins the rule list; REQ-CL-001 and REQ-CL-004 describe the outcomes of `apply`. | the maintainer, 2026-10-02 (same) |

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
