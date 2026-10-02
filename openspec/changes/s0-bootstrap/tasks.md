# Tasks

## 1. Trust

- [ ] 1.1 `trust/basis.ts` — `basis(session, acted)` by the table of TR-B02 (`REQ-TR-001`, design D-7); verified by
  tests with the token `SCN-TR-001` passing
- [ ] 1.2 `trust/facts.ts` — `currentFacts`, `liveRevision` (`REQ-TR-002`, design D-7); verified by tests with the
  token `SCN-TR-002` passing
- [ ] 1.3 `trust/namespace.ts` — `policyOf`, `actLogins`; `trust/index.ts` exports all three files (`REQ-CT-001`,
  design D-7); verified by tests with the token `SCN-CT-001` passing

## 2. Adapters of acts

- [ ] 2.1 `adapters/acts-init`, `adapters/acts-fixture` (`REQ-AC-002`, `REQ-AC-003`, design D-9); verified by tests
  with the tokens `SCN-AC-002` and `SCN-AC-003` passing
- [ ] 2.2 `adapters/acts-github` with recorded JSON in `test/fixtures/acts/github/` (`REQ-AC-005`, design D-9);
  verified by tests with the token `SCN-AC-005` passing
- [ ] 2.3 `adapters/acts-recorded` (`REQ-AC-004`, design D-9) — its re-apply part after task 3.4; verified by tests with
  the token `SCN-AC-004` passing
- [ ] 2.4 `test/acts/contract.test.ts` — one case, four adapters (`REQ-AC-001`, design D-11); verified by tests with
  the token `SCN-AC-001` passing

## 3. Ledger

- [ ] 3.1 `ledger/genesis.ts` — `SESSION_TYPE_BODY`, `GENESIS`, `GENESIS_PROPOSAL`, `GENESIS_HASH` (`REQ-LG-006`, design
  D-2); verified by tests with the token `SCN-LG-009` passing
- [ ] 3.2 `std/std.json` and `ledger/std.ts` — `STD_HASH`, `packageHash`, `readStd`, `stdProposal` (`REQ-LG-007`,
  design D-3); verified by tests with the token `SCN-LG-010` passing
- [ ] 3.3 `ledger/rules.ts`, `ledger/apply.ts` — the rule `CT-N02`, `EXEMPTIONS`, the exemption conditions; fixture
  `test/fixtures/rules/CT-N02/` (`REQ-LG-002`, design D-5); verified by tests with the tokens `SCN-LG-007`,
  `SCN-LG-008` and `SCN-AR-017` passing
- [ ] 3.4 `ledger/records.ts`, `ledger/apply.ts`, `ledger/commit.ts` — `apply` takes acts, the act record, the optional
  `acts` of the commit form; `test/ledger/cases.ts` gives L1 (`REQ-LG-003`, design D-6); verified by tests with the
  tokens `SCN-LG-003`, `SCN-LG-004` and `SCN-LG-012` passing
- [ ] 3.5 `ledger/init.ts` — `initProposals` (`REQ-LG-008`, `REQ-CT-002`, design D-4); verified by tests with the
  tokens `SCN-LG-011` and `SCN-CT-002` passing
- [ ] 3.6 `ledger/basis.ts` — `bases(commit)` (`REQ-LG-009`, design D-7); verified by tests with the token
  `SCN-LG-013` passing
- [ ] 3.7 `ledger/commit.ts` — `openStore` (`REQ-LG-010`, design D-8); `ledger/index.ts` exports the new names;
  verified by tests with the token `SCN-LG-014` passing
- [ ] 3.8 `test/ledger/permutation.test.ts` — the cases of `REQ-LG-005` with acts and the init proposals (design D-11);
  verified by tests with the token `SCN-LG-006` passing

## 4. Command

- [ ] 4.1 `assembly/index.ts` — `init` writes the four commits through apply with the `init` adapter, `Ports.std`, the
  refusal naming `LG-G02`; `commands/init.ts` prints the commit lines (`REQ-CL-002`, design D-3, D-10); verified by
  tests with the tokens `SCN-CL-002` and `SCN-CL-015` passing
- [ ] 4.2 `assembly/index.ts` — every command opens with `openStore` (`REQ-CL-004`, `REQ-CL-001`, design D-8); the CLI
  tests on a store holding the init commits (design D-11); verified by tests with the tokens `SCN-CL-001`,
  `SCN-CL-003` … `SCN-CL-014` and `SCN-CL-016` passing
- [ ] 4.3 The round trip through the entry still gives the fixture bytes (`REQ-CL-006`); verified by tests with the token
  `SCN-CL-010` passing

## 5. Review

- [ ] 5.1 Implementation review (skill `code-review`: Standards and Spec) before `VERIFYING`; findings and how each is
  closed in the impl-PR body
