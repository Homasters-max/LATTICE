# 11. Later and not taken

## Purpose

What is deliberately not in the design yet, and what is deliberately never taken. A deferred item returns only when its trigger fires, through the document it touches; until then no other document restates it. A not-taken item is never proposed again without a new argument against the reason given here.

## Later — with a trigger

| ID | What | Trigger | Touches |
|---|---|---|---|
| LT-01 | Mechanics of a kernel transition commit: an owner act; until it is written, a store under the new kernel is read-only. | the first kernel version change | LG-G01, LG-G03 |
| LT-02 | Owner queue: number of open findings per rule ID and the age of the oldest, no thresholds; at most 10 shown. | first findings in S1 | TR-N01 |
| LT-03 | Finding "retired against support": an entity is retired while its count "for" is at or above a threshold. | first verdicts | TR-N02, TR-V06 |
| LT-04 | The author's own verdict on their block does not count. | first verdicts | TR-V02 |
| LT-05 | Memo per candidate for a point `score`: a changed pool re-scores only new cards. | cost of S2 | DP-T03, PL-K03 |
| LT-06 | `state` sent once per request as a stable prefix, for the vendor's prompt cache (−42% tokens measured in v0.6). | S2 | DP-T05 |
| LT-07 | Run-to-run consistency on the same input, not only across `variants`. | S2 | BN-M04 |
| LT-08 | Classification of empty outcomes on the bench: search miss, real gap, or gap in the source's coverage. | S1 | BN-M02 |
| LT-09 | A second annotator on 20% of bench items. | the first bench set | BN-S04 |
| LT-10 | Import: every item has a stable anchor in its source and a hash of its full text (otherwise an edit after the first paragraph is invisible); the full text given by `ref@n` is checked against that hash. A field of the import type, not a general mechanism. | S4 | TR-S01, LN-O03 |
| LT-11 | Store trigger metric: p95 of store opening plus projection rebuild; the time of every opening goes to a log outside the ledger. | when LG-S02 needs a measurement | LG-S02, LG-J04 |
| LT-12 | Expiry command of `runtime` segments carries the epoch of the segment. | the first expiry (LG-R01) | LG-R01, LG-R05 |
| LT-13 | A pinned reference into an expired `runtime` segment resolves to a distinct result `expired`, not "no target". | the first expiry (LG-R01) | LG-S04 |
| LT-14 | Compatibility of context field types between stages, nominal through `extends`. | S2 | PL-P03 |
| LT-15 | A point pinned by a `live` pipeline drives only actions whose errors a later verdict will catch. | S3 | DP-L01 |
| LT-16 | Rejected duplicate pairs are not proposed again (history of `alias` or `dismissed`); the budget limits what is shown, not what is recorded. | the "duplicates" point | OM-D02 |
| LT-17 | References across projects. | after S1, when a second project needs them | CT-M03 |
| LT-18 | A numeric trust score. | the bench shows it improves LENS selection | TR-V01 |
| LT-19 | Consumer cues: phrasings that boost a block. | the bench shows a recall gap | LN-C05 |
| LT-20 | Contract test: `std` applies cleanly on every kernel version. | the second kernel version | LG-G02, CT-N02 |
| LT-21 | Pluggable projections: each module owns its projection, assembly passes the list when the store opens, so the ledger does not depend on every module. | a projection owned by a module other than `trust` | LG-J01, ST-M01 |
| LT-22 | Address of one decision inside a run (run `id` plus stage index) as a reference form, so a verdict on an outcome (DP-B05, DP-C04) can name that decision. Not a separate DecisionResult event (NX-25). | the first verdict on a decision outcome (S3) | OM-I05, TR-F05, PL-R03, DP-R06 |
| LT-23 | Runs on `holdout` only in CI on `recorded` answers, so the run count of BN-S05 is verifiable. | the first `live` pipeline that pins a point (S3) | BN-S05, BN-R01 |
| LT-24 | The code hash of a capability leaves out the modules below the stage seam (`kernel`, port interfaces); the LATTICE version in the execution tuple covers them. | the first `upgrade` where re-pinning pipelines (LG-G02) proves expensive | PL-C01, LG-G02, GL-07 |
| LT-25 | An act that cannot be posted by an agent holding the human's login: a check beyond the login. | the first act disputed as posted by an agent | CT-A05, CT-P03 |

## Not taken

Ideas of `design/` v0.6 that add a second mechanism next to a question already decided here.

| ID | What | Why not |
|---|---|---|
| NX-01 | Numeric trust: independence groups, weights, states contested / rejected / settled, oscillation, `overruled`, declarant. | A second trust mechanism; contradicts TR-V01, TR-V05, TR-B03. |
| NX-02 | Learning from verdicts: learn sessions, learning rows, learning gate, removal window, counted runs, `recheck_every`. | Verdicts would change knowledge automatically; contradicts TR-V06, DP-B02, DP-B05. |
| NX-03 | Suspended runs: `pending`, progress, pending TTL, answer and resume commands. | A waiting state; contradicts PL-R03. |
| NX-04 | Calibrated thresholds with `calibrated_for` and `onMismatch: mark`. | A second calibration path next to DP-C01 and DP-L06. |
| NX-05 | Rules as data: rule entities, `hard` / `soft` levels, lint, `when`, `examples`, `count` / `acyclic`. | A rule language; DP-B09, DP-B11. |
| NX-06 | Grain, regrain plans, `ensure` / `merge` / `split`, interning. | A third kind of identity; `unique` (OM-D01) and `alias` (OM-D02) are enough. |
| NX-07 | Stored values: `#hex32`, holds, payloads, snapshots. | Contradicts OM-K02. |
| NX-08 | `fuse`, scorers, RRF, cue and term entities, vocabulary boost. | A second path of scoring and cues; LN-C05, DP-B03. |
| NX-09 | Decision memory: `recall`, `recheck`, stored needs, solutions, membership, `divide`. | A second answer path next to `solve`; LN-N02. |
| NX-10 | Rights and identity: grants, authority, an actor registry, OS user, an actor environment variable, TTY confirmation. | A second path of rights and identity next to CT-N03 and the `acts` port; the OS user is also PII. |
| NX-11 | Campaigns on a ledger copy, bench copy marks, a simulated consumer. | A second store mode; `purpose: bench` is enough (TR-V03). |
| NX-12 | A bench plan object with `supersedes`. | A second object next to the set, its targets and the report; its discipline is BN-G04 and BN-S05. |
| NX-13 | A graph of stages, a pipeline DAG, a state machine of solving, composite capabilities. | DP-B09, PL-P05. |
| NX-14 | `deprecate`, `retire id@n`, `distinct`, load findings, gaps as stored facts. | New statuses outside the closed set TR-F04 and findings outside TR-N01. |
| NX-15 | A `$ref` marker in a body, found without the schema. | A second way to find references next to the fields of a type (OM-R02). |
| NX-16 | A commit idempotency key as a separate field, `differs`. | A second deduplication path; LG-C08 uses the proposal hash. |
| NX-17 | A check registry in the kernel, check views, overlays, a learning-gate primitive in the kernel. | Bloats the kernel; OM-L04. |
| NX-18 | Pipelines and ports in the namespace body; hot reload, JSON5, `$include`. | Mixes namespace policy with behaviour; CT-N03, PL-A01. |
| NX-19 | An index of executions read by commit checks. | Lets `runtime` into the checks of `knowledge`; LG-R04. |
| NX-20 | A reserved `$enc` key. | YAGNI. |
| NX-21 | Removing the `calibration` status fact and keeping only `live` and the report. | DP-S02 and DP-S03 need a calibration accepted by the owner; a calibration that references the report is enough (DP-C01, BN-R02). |
| NX-22 | Checking `derived` by re-running the import inside apply. | Pulls the codec and source adapters into `ledger`; the act answers the same question (TR-B02, CT-A05). |
| NX-23 | A separate CI job for bench metrics. | A second checker next to apply; LG-A01, LG-P05, DP-L06. |
| NX-24 | The read view (PL-K05) as a separate module. | An interface of `ledger` with one adapter: a hypothetical seam. |
| NX-25 | A DecisionResult stored as a separate event for verdicts to reference. | A second home next to DP-R06; an address inside a run (LT-22) is cheaper. |

## History

- 2026-10-01 — created from the design v0.6 audit (`reviews/2026-10-01-design-v06-audit.md`), grilled: items L, G09, and the items deferred by 09 moved here; groups X recorded as not taken.
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): LT-22 (address of a decision inside a run, R08), LT-23 (verifiable holdout, R16), LT-24 (capability hash below the seam, R17); LT-21 trigger rewritten, LT-15 through pipelines; NX-21…NX-25 from the review's list of ideas not proposed; follow-up: LT-25 (an act posted by an agent).
