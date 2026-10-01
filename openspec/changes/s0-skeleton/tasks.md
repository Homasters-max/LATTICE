# Tasks

## 1. Structure test: module matrix and purity

- [x] 1.1 Policy data `modules` and `ports` in `test/architecture/structure.ts` and the project table of REQ-AR-009 in
  `test/architecture/policy.ts`; rules `outside-matrix`, `import-direction`, `package-import` over the parsed tree;
  fixture `test/fixtures/structure/matrix/` (`REQ-AR-009`, design D-3); verified by tests with the token `SCN-AR-015`
  passing, and the tests `SCN-AR-009`…`SCN-AR-014` passing
- [x] 1.2 Purity of pure modules — `purity` with its import rules off for `trust`, `measure`, `ledger`, `codec`,
  `runtime`, `capabilities`; fixture `test/fixtures/structure/purity/` (`REQ-AR-010`, design D-3); verified by tests
  with the token `SCN-AR-016` passing
- [x] 1.3 The existing structure tests renamed to the tokens of the English requirements — SCN-AR-001…007 →
  SCN-AR-008…014 (`REQ-AR-005`…`REQ-AR-008`); verified by tests with the tokens `SCN-AR-008`…`SCN-AR-014` passing, no
  test carrying `SCN-AR-001`…`SCN-AR-007` left, `SCN-AR-008` on the project with the modules of the
  project policy

## 2. Module folders and ports

- [x] 2.1 `src/trust/index.ts`; port interfaces `src/ledger/ports/{store,acts}.ts`, `src/runtime/ports/{clock,ids}.ts`
  (`REQ-AR-009`, design D-1, D-2); verified by the test `SCN-AR-008` passing with these files present
- [x] 2.2 Adapters `store-jsonl`, `clock-system`, `clock-fixed`, `ids-ulid`, `ids-counter` (`REQ-AR-009`,
  `REQ-CL-004`, design D-9); verified by `SCN-AR-008` passing and by unit tests under the token `SCN-CL-005` (the JSONL
  adapter appends after the expected `seq` and answers `moved` otherwise; `ids-ulid` gives 26-character ULIDs)

## 3. Ledger: proposal, apply, projection

- [x] 3.1 `ledger/proposal.ts` — intents, `parseProposal` with the `LG-P01` and `LG-C07` rejections, canonical order,
  proposal hash (`REQ-CL-004`, `REQ-CL-003`, design D-4); verified by tests with the token `SCN-CL-007` passing
- [x] 3.2 `ledger/commit.ts`, `ledger/projections/latest.ts`, `ledger/apply.ts`, `ledger/rules.ts` — `openLedger` with
  the LG-C04 chain check, the latest-revision projection and read view, `apply` with `LG-P02`, the commit form
  (`REQ-CL-004`, `REQ-CL-005`, design D-5); verified by tests with the tokens `SCN-CL-005`, `SCN-CL-006`, `SCN-CL-008`
  passing
- [x] 3.3 Rule fixtures `test/fixtures/rules/{LG-C07,LG-P01,LG-P02}/` and `test/architecture/rules.test.ts`
  (`REQ-AR-011`, design D-5, D-10); verified by tests with the token `SCN-AR-017` passing

## 4. Codec

- [x] 4.1 `codec/table.ts`, `codec/import.ts`, `codec/export.ts` — the skeleton form, `importMd`, `exportMd` through the
  read view (`REQ-CL-003`, `REQ-CL-005`, design D-6); verified by tests with the tokens `SCN-CL-003`, `SCN-CL-004`,
  `SCN-CL-009` passing

## 5. Assembly and CLI

- [x] 5.1 `assembly/index.ts` — the composition root with default and injected ports (`REQ-CL-002`…`REQ-CL-005`, design
  D-7); verified by the tests of 5.2
- [x] 5.2 `cli/main.ts`, `cli/run.ts`, `cli/table.ts`, `cli/commands/{init,import-md,apply,export}.ts` (`REQ-CL-001`…
  `REQ-CL-005`, design D-8); verified by tests with the tokens `SCN-CL-001`…`SCN-CL-009` passing
- [x] 5.3 Fixture `test/fixtures/md/fixture.md` and `test/e2e/roundtrip.test.ts` through the entry as a child process
  (`REQ-CL-006`, design D-10); verified by the test with the token `SCN-CL-010` passing
- [ ] 5.4 Maintainer's patch of `package.json` (`bin` `lattice`, design D-8, D-10) attached to the impl-PR and applied
  by the maintainer; verified by `git diff main -- package.json` showing only the `bin` entry

## 6. Verification

- [x] 6.1 Manual acceptance in an empty temporary folder: `init`, `import-md` of the fixture, `apply`, `export` through
  `node --experimental-strip-types <repo>/src/cli/main.ts` (SL-T06); verified by the four exit codes 0 and an empty
  `git diff --no-index` between the fixture and the export, recorded in the impl-PR body
- [ ] 6.2 `npm run typecheck`, `npm test` and `warrant verify s0-skeleton`; verified by all three succeeding, and
  `git diff main -- src/kernel test/kernel` being empty
