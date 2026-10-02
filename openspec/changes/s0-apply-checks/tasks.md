# Tasks

## 1. Rejections and duplicates

- [ ] 1.1 `ledger/rules.ts` — `LG-C03` in `REJECTION_RULES`, the optional `with` and `differs` of a rejection, the
  constructor `duplicate`; `ledger/differs.ts` — `differs(values)` (`REQ-LG-002`, design D-2, D-3); verified by tests
  with the tokens `SCN-LG-002` and `SCN-LG-007` passing
- [ ] 1.2 `ledger/apply.ts` — `LG-C07` gives one rejection per later intent of a duplicated `id`, with `with` and
  `differs`; `LG-P02` unchanged (`REQ-LG-002`, design D-3); fixture `test/fixtures/rules/LG-C07/expected.json` with the
  new fields; verified by tests with the tokens `SCN-LG-002`, `SCN-CL-007` and `SCN-AR-017` passing

## 2. Outcomes of apply

- [ ] 2.1 `ledger/apply.ts` — the no-op of an entity intent, the held intents, the outcome `no-op`, a commit of only
  the held intents whose `proposal` is their hash (`REQ-LG-003`, design D-4); verified by tests with the token
  `SCN-LG-003` passing
- [ ] 2.2 `ledger/commit.ts` — `Ledger.proposals` filled by `openLedger`; `ledger/apply.ts` — the outcome `existing`
  from the hash of the held intents, before the rejections (`REQ-LG-003`, design D-5); verified by tests with the
  token `SCN-LG-004` passing
- [ ] 2.3 `ledger/apply.ts` — `checkTail`: `existing`, `clear` or the rejection `LG-C03` (`REQ-LG-004`, design D-6);
  fixture `test/fixtures/rules/LG-C03/` with `moved.jsonl`; verified by tests with the tokens `SCN-LG-005` and
  `SCN-AR-017` passing
- [ ] 2.4 `ledger/index.ts` exports `checkTail`, `Applied`, `TailCheck`, `differs`; `test/ledger/apply.test.ts` reads proposals
  through `parseProposal` (`REQ-LG-001`); verified by tests with the token `SCN-LG-001` passing

## 3. Command and rule test

- [ ] 3.1 `assembly/index.ts` — the `apply` operation: `existing` and `no-op` remove the proposal file and print their
  outcome; on `moved` the ledger is read again and `checkTail` gives `existing`, the rejection or a store fault
  (`REQ-CL-004`, `REQ-CL-001`, design D-6); verified by tests with the tokens `SCN-CL-011`, `SCN-CL-012`, `SCN-CL-013` passing, and `SCN-CL-005`,
  `SCN-CL-006`, `SCN-CL-008` still passing
- [ ] 3.2 `test/architecture/rules.test.ts` — no enumerated list; `moved.jsonl` checked through `checkTail`; a
  fixture whose ledger does not open or whose `expected.json` is empty fails (`REQ-AR-011`); verified by tests with the token `SCN-AR-017` passing

## 4. Permutation test

- [ ] 4.1 `test/ledger/permutation.test.ts` — the cases and the comparison of design D-7 (`REQ-LG-005`); verified by
  tests with the token `SCN-LG-006` passing

## 5. Close

- [ ] 5.1 `npm run typecheck` and `npm test` green, the structure test (`SCN-AR-008`) included; implementation review
  (skill `code-review`) with its findings in the impl-PR body
