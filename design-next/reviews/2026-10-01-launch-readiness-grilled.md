# Launch readiness: grilled

- **Date:** 2026-10-01
- **Status:** review record — input for decisions, not norm. The norm is the rules it names in 00–11.
- **Input:** is `design-next` ready to start S0, and how does LATTICE come to run on itself?
- **How:** grilling in rounds; every decision accepted by the maintainer on 2026-10-01. Applied to `design-next` 00, 03, 06, 09, 10, 11 and the README in the same PR.
- **Outcome:** a switch milestone SW between S0 and S1 (SL-T07, SL-SW); slices start with a walking skeleton and grow per AREA in parallel Changes (SL-T08, SL-T09); development discipline (ST-M02, ST-M03); `import-md --diff` not taken (NX-26). No NX revisited.

## Decisions

| # | Question | Decision | Recorded in |
|---|---|---|---|
| Q1 | How does LATTICE come to run on itself? | In stages: (a) the design moves into the ledger at SW; (b) after S1, when `solve` is `live`, the agent takes the context for its own Changes from `solve` instead of reading `md`; (c) OpenSpec specs never become blocks. | SL-T07, SL-T03 |
| Q2 | When does the design move into the ledger? | At a separate milestone SW between S0 and S1, triggered only when all six conditions hold: round trip green in CI; kernel frozen as `1` with the schema subset shown to cover every `std` type of 03–08; `upgrade` `std@1 → @2` in a test; CI runs LG-P05 on every PR with acts through `github`; the store command `draft` exists; one rehearsal of a real design edit through a proposal on a separate branch. | SL-T07, SL-SW, SL-S0 |
| Q3 | What is the status of a store before SW? | Disposable: kernel version `0`, rebuilt from `md`, kernel changes free. At SW genesis is written under kernel `1` and `import-md` runs once with the maintainer's act. After SW a kernel change needs the mechanics of LT-01 first; LT-20 fires on the same change. | LG-G05, LT-01, LT-20 |
| Q3b | How is the design edited after SW? | Through the store command `lattice draft`: it writes intents into a proposal and never reads `md`; `md` stays export only. `import-md --diff` is not taken: a second path into `knowledge`. | PL-E02, PL-E01, NX-26 |
| Q4 | How is S0 split into Changes? | Vertically. First `s0-skeleton`; then in parallel `s0-codec-forms` (codec), `s0-apply-checks` (ledger), `s0-store` (store adapters, lock, fencing, recovery, contract tests), `s0-kernel` (admission per the kernel review, schema subset, meta-type, old code re-bound per SL-T02), `s0-bootstrap` (`std`, namespace, basis table, `live`, `setup`, adapters of the `acts` port), `s0-projections` (referrers, latest revision, deterministic rebuild); last `s0-roundtrip` (the whole corpus, a hard gate in CI). | SL-T09, SL-T08; the Change list is planning, not norm |
| Q5, Q14 | How do the remaining design edits land before S0? | Two docs PRs: this one, then the normalization by a one-off script (LG-B04); then the maintainer tags `design-next-v0.2`. | SL-T01, README Status |
| Q6 | How do specs show which design IDs they implement? | A line `Implements: <ID>, …` under the requirement, plain text, never inside an id comment. A test `test/process/design-coverage` checks SL-T06: report-only until SW, failing after it. | SL-T03, SL-T06 |
| Q7 | What is the file structure? | `src/` modules per ST-M01: `kernel`, `trust`, `ledger`, `codec`; `measure`, `runtime`, `capabilities` from S1; `adapters/<one folder per adapter>`; `assembly`; `cli`. `std/` for the `std` package, `store/` for the project store, `.lattice/` for local state. `test/`: `architecture`, `contract`, one folder per module, `e2e`, `process`, `fixtures` (frozen JCS vectors, `rules/<RULE-ID>/`, `reference-ledgers/`). No build step: `node --experimental-strip-types`; `bin: lattice`. | LG-S05 (paths); the rest is built by `s0-skeleton` (SL-T09) |
| Q8 | What happens to issues #27 and #20? | #27 closes as `wontfix`; the maintainer checks the protection of `main`, then #20 closes. | GitHub issues, not design |
| Q9, Q18 | What is the first Change? | `infra-baseline` (a factory change): a CI job running test and typecheck on every PR and on push to `main` (#28); artifacts language English; project rules translated to English; `areas.json` rewritten (Q20). | WARRANT Change, not design |
| Q10 | Which letter do prose IDs use? | `Z` (`DP-Z01`, `OM-Z01`, `LG-Z01`): `P` is taken by the rule groups `LG-P` and `PL-P`. `Z` is reserved for prose; no rule group uses it. | LG-B06, LG-B04 |
| Q11 | Which versions exist and where do they live? | The kernel version is a constant of kernel code (`0` before SW, `1` from SW); the LATTICE version is the package version (semver); `std@1` is loaded at SW and its hash is a constant of the LATTICE version. | LG-G06 |
| Q12 | Who owns and writes the project namespace? | Namespace `lattice`; owner `Homasters-max` (human); writers: `Homasters-max` by name and the agent account `homasters` by kind `agent`. The agent authors intents; acts come from the owner as PR comments. | SL-K04 |
| Q13 | How does a Change that edits the design work after SW? | It carries a proposal; `lattice apply` on the current `main` tail is the step before `warrant verify` in its impl-PR; if `main` moved, the branch syncs and the commit is rebuilt from the proposal. | SL-T10 |
| Q15 | What does the skeleton of S0 run on? | A synthetic fixture `md` (one table with IDs), not the corpus; the corpus comes in the closing Change of the slice. | SL-T09 |
| Q16 | What happens to the existing specs `architecture` and `kernel`? | The skeleton replaces spec `architecture`; `s0-kernel` replaces spec `kernel`. The kernel review is refreshed at the start of `s0-kernel`. | SL-T03; WARRANT Changes |
| Q17, Q19 | Which language, and how is the work tracked? | Everything project-side is in English; Russian only in chat with the maintainer. GitHub milestones S0, SW, S1–S4; one issue per Change with "Depends on"; an issue for SW with the SL-T07 checklist. | README Language; GitHub, not design |
| Q20 | What is the unit of parallel work? | A capability (an OpenSpec spec) is one WARRANT AREA and has at most one active Change. Areas rewritten: AR architecture, KR kernel, LG ledger, PJ projections, ST store, CD codec, TR trust, AC acts, CL cli, CT catalog, AD adapters, BN bench, LN lens, RN runtime, MS measure, CA capabilities; GR, RL, CP removed — not taken by NX-06, NX-05, NX-13. | SL-T08; `areas.json` in `infra-baseline` |
| Q21 | In which order do the Changes of S0 run? | In waves: the spec-PRs of wave 2 after the skeleton's spec-PR merges; the impl-PRs of wave 2 after its impl-PR merges. One worktree per Change; `implement` Runs narrowed with `--scope src/<module>/** test/<module>/**`. | SL-T09; process, not design |
| Q22 | How many Changes at once? | At most three in implementation: the maintainer's acts are the bottleneck. | SL-T08 |
| Q23 | Who owns files shared by several modules? | The skeleton: the module matrix of the structure test, the CLI entry, `package.json`, the port interfaces; a later change to one is a separate small Change. | SL-T08 |
| Q24 | In what order does the work start? | `infra-baseline` in parallel with this docs PR → normalization → tag `design-next-v0.2`; the skeleton starts after `infra-baseline`. | SL-T01; planning, not norm |

## Development principles reviewed

Input: a proposal to fix DDD principles for the development of LATTICE.

| Principle | Decision | Recorded in |
|---|---|---|
| A walking skeleton through command → check → store → projection → read | Taken. | SL-T09 |
| A new layer only with a second real variant or a real invariant | Taken. | ST-M02 |
| Growth per capability, not per layer | Taken, as growth per AREA. | SL-T08, SL-T09 |
| DDD layers Domain / Application / Infrastructure | Not taken: ST-M01 already is the split; a second answer to "where does code live". | ST-M03 |
| Entities, Value Objects, Aggregates | Not taken: they collide with the LATTICE terms entity and event (OM-K01); SL-T02 keeps one `Revision` structure. | ST-M03 |
| "Events are facts, not commands" | No rule needed: OM-K01 and LG-P01 already say it — intents are the commands. | — |
| The chain "Design → Spec → Change → … → Apply" | Not taken: it mixes the development process with the behaviour of the product. | — |

## Notes on wording

- SL-T08 uses the term **AREA** for the unit of Q20, because "capability" is already defined by PL-C01 (one term — one definition).
- SL-T04 keeps "one slice is one WARRANT Change" for a small slice and points to SL-T08 and SL-T09 for a large one.
