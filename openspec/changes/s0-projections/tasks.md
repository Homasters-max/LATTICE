# Tasks

## 1. The view and its fold

- [x] 1.1 `ledger/projections/projection.ts` — `Edge`, `Revisions`, `Projection<S>`; `ledger/projections/view.ts` —
  the fold step, `rebuild`, `PROJECTIONS` with the projection `latest`, the `ReadView` with `seq`, `get`, `entities`,
  `revision` by ledger order (`REQ-PJ-001`, design D-2, D-3, D-4); `ledger/projections/latest.ts` — `latest(commits) =
  rebuild(commits)`, re-exports `ReadView` (design D-1); verified by tests with the tokens `SCN-PJ-001` and
  `SCN-PJ-011` passing, and the apply, export and round-trip tests of `test/ledger/**` and `test/cli/**` still passing

## 2. Referrers

- [x] 2.1 `ledger/projections/referrers.ts` — the references of a record (`/type`, `of`, the admission under its
  resolved type) one per path, the bounded type chain and its cache, the edge set by source and by target,
  `referrers(id)` in the view (`REQ-PJ-002`, design D-4, D-5, D-6); verified by tests with the tokens `SCN-PJ-002`,
  `SCN-PJ-003` and `SCN-PJ-004` passing

## 3. Extension, serialization, permutation

- [x] 3.1 `ledger/projections/view.ts` — `extend` with its `base` check, its refusal value and copy on write;
  `serialize`; `rebuild` refusing a list that is not a permutation (`REQ-PJ-003`, `REQ-PJ-004`, design D-3, D-7);
  verified by tests with the tokens `SCN-PJ-005`, `SCN-PJ-006` and `SCN-PJ-007` passing

## 4. Reference ledgers and CI

- [x] 4.1 `test/projections/reference.ts` — the generator of the cases `skeleton` (through `apply`) and `typed` (commits
  built directly); the files `test/fixtures/projections/{skeleton,typed}/{ledger.jsonl,index.json}` written by it;
  `test/projections/ledgers.ts` with the expected edges (`REQ-PJ-005`, design D-8, D-10); verified by tests with the
  tokens `SCN-PJ-008` and `SCN-PJ-009` passing
- [ ] 4.2 The maintainer's patch of `.github/workflows/test.yml` — the job `projections-windows` of design D-9, asked in
  the impl-PR before its last commit; `test/projections/ci.test.ts` (`REQ-PJ-005`, design D-9, D-10); verified by tests
  with the token `SCN-PJ-010` passing, and by the check `projections-windows` passing on the impl-PR with `SCN-PJ-008`
  in its log before the merge is asked (design D-9)

## 5. Close

- [ ] 5.1 `npm run typecheck` and `npm test` green, the structure test (`SCN-AR-008`) included; implementation review
  (skill `code-review`) with its findings in the impl-PR body
