# 08. Bench

## Purpose

How to prove that something got better: calibration of decision points and quality of pipelines, measured on sets written by humans.

## Sets

| ID | Rule |
|---|---|
| BN-S01 | A bench item is a `bench-item` block with basis `asserted`: an input (a need or a point `state`) and an expected answer (expected refs or value). An item has a kind: `normal`; `trap` — at most 15% of its words are shared with the text of the expected block; `blank` — a question near the topic that has no answer in the scope. A set holds at least 10 `trap` and 10 `blank` items; without them `none` and `insufficient` cannot be calibrated. |
| BN-S02 | A bench set is a composition of pinned references to items. A new revision of a set needs an owner act by default (CT-A02). |
| BN-S03 | An item may have `variants`: paraphrases and translations of the same input with the same expected answer (DP-G02). |
| BN-S04 | Item sources: written by a human; grown from escalations (DP-C05); grown from `shadow` disagreements; grown from consumer feedback on usefulness (TR-V10). Items from escalations and `shadow` disagreements go only to `tune`, never to `holdout`; search misses become `trap` candidates. An agent may draft an item; it gets basis `asserted` only by an act on the drafted intent (TR-B02, TR-I04), and enters a set only through a new set revision (BN-S02). Expected answers from the judge or an LLM are forbidden — otherwise the bench checks the judge with its own answers. |
| BN-S05 | A set is split into `tune` (thresholds are chosen on it) and `holdout` (the move to `live` is checked on it). The split is deterministic, by hash of the item `id` and a salt of the set revision. Tuning reports never show `holdout` numbers. The number of runs on the `holdout` of each `set@n` is recorded; rotation is a new set revision with a new salt. In v1 that count is local and unverified (CT-P04); the owner is responsible (LT-23). |
| BN-S06 | Questions come from real tasks (issues, PRs, commits, the work of a consumer), never from retelling the text of the documents: questions written while looking at the documents repeat their wording and inflate BM25 and the judge. Expected answers are fixed in the ledger before any run on the set. The report shows the lexical overlap of each question with its expected blocks. |

## Metrics

| ID | Rule |
|---|---|
| BN-M01 | Point calibration: the metrics of DP-C02. |
| BN-M02 | Pipeline quality: for `solve` — `hit@k`, MRR and pool recall (the needed block entered the pool at all); precision and recall of refusal (`none`) on `blank` items, counted separately; cost per accepted result, from the costs on the tape (PL-K01). Every metric is also broken down by kind of block (tables, code, long blocks): an average hid the kind whose meaning did not fit into the card. |
| BN-M03 | Baselines for every metric are pipeline revisions, not settings: BM25 only without the judge; BM25 over whole documents (a document hit next to a block hit); full text instead of the card. If the judge is not better than BM25, it shows at once. |
| BN-M04 | Consistency: share of `variants` that give the same answer as the main input. |
| BN-M05 | Minimum size per answer value in `holdout`, default 30. Below it the report says `insufficient-data`, and the move to `live` is impossible. |
| BN-M06 | A comparison decides by the lower bound of a paired bootstrap of the difference (95%, fixed seed, chosen by someone other than the author of the change). Noise is measured by repeated runs with memoization off, a field of `setup` (PL-A01; memoization hides variance, PL-K03). |

## Targets and gates

| ID | Rule |
|---|---|
| BN-G01 | Targets are data: a point has target precision (DP-C03) and target consistency; a pipeline has targets per metric (`targets`, PL-P01); both have a regression tolerance, no smaller than the measured noise (BN-M06). Default targets: precision and recall of refusal at least 0.8; every kind of block (BN-M02) not below its baseline. |
| BN-G02 | Whether a report meets the targets is decided by the gate (DP-L06), code of module `measure`; the `live` fact still requires an owner act citing the report (TR-F06). Code checks the numbers; a human decides. |
| BN-G03 | A report compares the new revision with the current `live` one on the same set: the overall difference and the list of items that got worse. A regression beyond tolerance is a finding; the move to `live` requires an explicit owner decision on it. Reports are comparable only with the same execution tuple except the revision under test, the same knowledge commit and the same environment (PL-R01); otherwise the comparison is `invalid`. |
| BN-G04 | A report counts for a gate only if its targets were in the ledger (by `seq`) before its runs: a target lowered after looking at `holdout` numbers never admits that report. |

## Where it runs

| ID | Rule |
|---|---|
| BN-R01 | The bench runs locally, in a session with `purpose: bench`. |
| BN-R02 | A **report** is a fact of the `std` type `report`, keyed by subject `ref@n` (a pipeline or a decision point revision) and `set@n`, with basis `observed` (`machine`, purpose `bench`, TR-B02). It enters `knowledge` by proposal together with the cited `runtime` segments (LG-R04). There is one report per subject and set; a `calibration` references it, never copies it (TR-F05). |
| BN-R03 | The metrics of a report are recomputed from its cited segments by the gate (DP-L06); CI only runs apply (LG-P05). |

## History

- 2026-09-30 — grilled (9 questions).
- 2026-10-01 — unified-architecture review, grilled: owner act on agent drafts (BN-S04), restatements replaced by references (BN-S02, BN-M01, BN-R03), gate before `live` run by apply (BN-G02), basis of reports from TR-B02 (BN-R02).
- 2026-10-01 — design v0.6 audit, grilled: `trap` and `blank` items (BN-S01), escalations only to `tune` (BN-S04), salt and run count (BN-S05), questions from real tasks (BN-S06), MRR, refusal and per-kind metrics (BN-M02), baselines as pipeline revisions (BN-M03), bootstrap and noise (BN-M06), default targets (BN-G01), pipeline gate (BN-G02), comparability (BN-G03), targets before runs (BN-G04).
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): expected answer (BN-S01, BN-S03); defaults of owner acts (BN-S02); agent drafts by act (BN-S04; D4); holdout run count local and unverified (BN-S05); memoization in `setup` (BN-M06); pipeline `targets` (BN-G01); one gate in `measure` (BN-G02, BN-R03; D1); one report fact per subject and set (BN-R02).
