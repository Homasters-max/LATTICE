# 07. LENS and solve

## Purpose

How blocks are selected for a need. LENS is an instance of the decision pattern (DP-N01) inside the `solve` pipeline (PL-E01).

```text
need → candidates (BM25 + ids from the need) → decide(score) → top-k + budget → expand by edges → decide("sufficient?") → context
```

## Need

| ID | Rule |
|---|---|
| LN-N01 | `need = {text, scope, budget}`. `text` is English or prepared per DP-G02; `scope` — types and domains; `budget` — characters and number of blocks; it is the run's one budget field (DP-M05). |
| LN-N02 | A need is a run input with a fingerprint, not a stored entity. |
| LN-N03 | Default `scope` is all project namespaces. `std` types enter the pool only when listed explicitly, so `std` blocks do not crowd out knowledge. |

## Candidates

| ID | Rule |
|---|---|
| LN-C01 | Candidate source: BM25 over card text within `scope`. If the scope has at most `pool_max` blocks (default 200), all enter the pool; otherwise the BM25 top-N. |
| LN-C02 | Blocks named by id in the need are guaranteed candidates: they enter the pool even if BM25 would cut them, and the judge scores them like any other candidate. They are not `required` (DP-M05), so a casual mention of an id never eats the budget. `required` is declared only by a point. |
| LN-C03 | BM25 uses a simple English tokenizer with Porter stemming. The tokenizer is a capability pinned by hash; changing it is a new revision (PL-C03), checked by the bench and `shadow` before the pipeline that uses it becomes `live` (PL-P06). |
| LN-C04 | The pool follows the output rule (LN-O04). Hints (types extending `hint`, TR-I02) enter only with an explicit `hint` label, so the LLM sees an inference, not knowledge. They are never mixed in silently. |
| LN-C05 | In v1 there are no consumer cues (phrasings that boost a block; LT-19). A consumer's feedback on `solve` output follows TR-V10. |
| LN-C06 | The point `lens-rank` declares its allowed set as `scope` (DP-M06): blocks within the need's scope (LN-N03). The pool written by `lens.candidates` must lie inside it (DP-M06). |

## Expansion

| ID | Rule |
|---|---|
| LN-X01 | After selection a separate deterministic stage expands along references from the selected blocks, within the budget and under the output rule (LN-O04). Code does this, not the judge. |
| LN-X02 | A type names every reference field — an edge label (`uses`, `rationale`, `pins`, …). The expansion params list edge labels, direction (outgoing references or referrers) and depth (default 2). Without an explicit list there is no expansion; "walk the whole graph" is never the default. |
| LN-X03 | Added blocks are marked `via: <ref>`. Whether they are worth the budget is decided by the second point "sufficient?" (DP-D03); until that point exists (S2), expansion stops at the remainder of the budget (DP-M05). |

## Output

| ID | Rule |
|---|---|
| LN-O01 | `solve` returns a list of `{ref@n, card, why}`, where `why` is one of `required`, the judge score, `via: <ref>`. A `fallback` is marked as PL-R01 requires. When the output is placed into an LLM prompt, block text is wrapped as data (PL-R04). |
| LN-O02 | Each item carries trust evidence: basis, in force, counts per basis (TR-V05). |
| LN-O03 | The LLM requests the full text of a block separately by `ref@n`, under the output rule (LN-O04). |
| LN-O04 | One output rule for the whole of `solve` — pool, `required`, expansion and full text: a block whose `id` has a `retired` fact in force (TR-F05), or that has no current revision (TR-I01), is never given out as content, by any path. If such a block was named by id (LN-C02, `required`, a full-text request), the output holds an item without a card, with status `retired` or `not-in-force` and, for an alias, the canonical `id` (OM-R06) — never a silent drop. |

## Budget

| ID | Rule |
|---|---|
| LN-B01 | Budget is counted in characters of card text, not in model tokens: characters are deterministic and independent of the model, whose tokenizer changes with it. A rough ratio to tokens is a stage param. |

## History

- 2026-09-30 — grilled (10 questions).
- 2026-10-01 — unified-architecture review, grilled: need budget is the run budget (LN-N01), exclusion by status facts (LN-C04), allowed set of `lens-rank` (LN-C06).
- 2026-10-01 — design v0.6 audit, grilled: ids in the need are guaranteed candidates, not `required` (LN-C02), one output rule (LN-O04, LN-C04, LN-X01, LN-O03), usefulness feedback is not a verdict (LN-C05), fallback marked and text wrapped as data (LN-O01).
- 2026-10-01 — final review (`reviews/2026-10-01-design-next-final-review.md`), grilled (24 questions): ids from the need in the diagram, `scope` as the allowed set (LN-C06), expansion stops at the remainder until S2 (LN-X03), output rule by current revision (LN-O04), `std` blocks (LN-N03), restatements replaced by references (LN-C05, LN-O01).
