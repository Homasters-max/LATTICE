# Tasks

## 1. Contract harness and memory adapter

- [ ] 1.1 `test/store/harness.ts` — one harness per adapter (`make`, `seed`, `tear`, `lock`, `unreadableLock`,
  `lockOwner`, `recovered`, `dispose`) (`REQ-SR-001`, design D-7); verified by `npm run typecheck` passing and by the
  tests of 1.2 using it for both adapters
- [ ] 1.2 `src/adapters/store-memory/index.ts` — `memoryLedger`, `memoryStore` with the lock, fencing and recovery of
  D-5, D-6 (`REQ-SR-001`, `REQ-SR-002`, `REQ-SR-004`, design D-2, D-6) and `test/store/contract.test.ts`; verified by
  the `[memory]` tests with the tokens `SCN-SR-001`, `SCN-SR-002`, `SCN-SR-003`, `SCN-SR-004`, `SCN-SR-006`,
  `SCN-SR-007` passing, and by `SCN-AR-008` passing with the new adapter folder

## 2. JSONL adapter hardened

- [ ] 2.1 `src/adapters/store-jsonl/index.ts` — options, lock file, take-over and fencing, `append` of D-5
  (`REQ-SR-001`, `REQ-SR-002`, design D-1, D-2, D-3, D-5); verified by the `[jsonl]` tests with the tokens
  `SCN-SR-001`, `SCN-SR-002`, `SCN-SR-003`, `SCN-SR-004` passing
- [ ] 2.2 Recovery of a torn tail on bytes in `read` and in `append` (`REQ-SR-004`, design D-4); verified by the
  `[jsonl]` tests with the tokens `SCN-SR-006`, `SCN-SR-007` passing, and the test with the token `SCN-SR-006` in
  `test/store/jsonl.test.ts` (the cut UTF-8 character) passing
- [ ] 2.3 Durable append: write loop, `fsync`, the `fs` option (`REQ-SR-003`, design D-5); verified by the tests with
  the token `SCN-SR-005` in `test/store/jsonl.test.ts` passing

## 3. CLI

- [ ] 3.1 Before the first commit of the impl-PR, check that no Change in implementation names `test/cli/apply.test.ts`
  (design D-8); verified by the check stated in the impl-PR body
- [ ] 3.2 `test/cli/store.test.ts`; in `test/cli/apply.test.ts` the removals of design D-7 (`REQ-CL-001`, `REQ-CL-004`);
  verified by the tests with the tokens `SCN-CL-011` and `SCN-CL-012` passing, every other test of `test/cli/` passing
  unchanged, and `git diff main -- test/cli/apply.test.ts` showing removed lines only

## 4. Verification

- [ ] 4.1 Manual acceptance in an empty temporary folder through `node --experimental-strip-types
  <repo>/src/cli/main.ts`: `init`, `import-md` of the fixture, append 20 bytes of garbage without a line feed to
  `store/knowledge.jsonl`, `apply`, `export` (SL-T06); verified by the exit codes 0, one file in `store/recovered/`
  holding the 20 bytes, no `store/knowledge.jsonl.lock`, recorded in the impl-PR body
- [ ] 4.2 `npm run typecheck`, `npm test` and `warrant verify s0-store`; verified by all three succeeding, and
  `git diff main -- src/ledger src/assembly src/cli package.json test/architecture` being empty
