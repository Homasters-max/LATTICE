# Tasks

## 1. Contract harness and memory adapter

- [ ] 1.1 `test/store/harness.ts` — one harness per adapter (`make`, `seed`, `tear`, `completeTorn`, `lock`,
  `unreadableLock`, `lockOwner`, `recovered`, `dispose`) (`REQ-SR-001`, design D-7); verified by `npm run typecheck`
  passing and by the tests of 1.2 using it for both adapters
- [ ] 1.2 `src/adapters/store-memory/index.ts` — `memoryLedger`, `memoryStore` with the lock, fencing, the `recover`
  option and recovery of D-4, D-5, D-6 (`REQ-SR-001`, `REQ-SR-002`, `REQ-SR-004`, design D-2, D-6) and
  `test/store/contract.test.ts`; verified by the `[memory]` tests with the tokens `SCN-SR-001`, `SCN-SR-002`,
  `SCN-SR-003`, `SCN-SR-004`, `SCN-SR-006`, `SCN-SR-007`, `SCN-SR-008`, `SCN-SR-009`, `SCN-SR-011`, `SCN-SR-012`,
  `SCN-SR-013`, `SCN-SR-014` passing, and by `SCN-AR-008` passing with the new adapter folder

## 2. JSONL adapter hardened

- [ ] 2.1 `src/adapters/store-jsonl/index.ts` — checked options, lock files created whole and verified
  (compare-and-swap), removal of smaller files by a take that holds, removal of its own file by a take that does not,
  a release that replaces its own file by an expired lock, fencing with the margin, `append` of D-5 (`REQ-SR-001`,
  `REQ-SR-002`, design D-1, D-2, D-3, D-5); verified by the `[jsonl]` tests with the tokens `SCN-SR-001`, `SCN-SR-002`,
  `SCN-SR-003`, `SCN-SR-004`, `SCN-SR-008`, `SCN-SR-011`, `SCN-SR-013`, `SCN-SR-014` passing
- [ ] 2.2 Recovery of a torn tail on bytes with `recover: true`, determined again under the lock and fenced before the
  cut, in `read` and in `append` (`REQ-SR-004`, design D-4); verified by the `[jsonl]` tests with the tokens
  `SCN-SR-006`, `SCN-SR-007`, `SCN-SR-009`, `SCN-SR-012` passing, and the tests with the tokens `SCN-SR-006` (the cut
  UTF-8 character) and `SCN-SR-010` in `test/store/jsonl.test.ts` passing
- [ ] 2.3 Durable append: write loop, `fsync`, swallowed release failure, the `fs` option (`REQ-SR-002`, `REQ-SR-003`,
  design D-5); verified by the tests with the token `SCN-SR-005` in `test/store/jsonl.test.ts` passing

## 3. Verification

- [ ] 3.1 Every test outside `test/store/**` passes unchanged (design D-7, I-27); verified by `npm test` passing and
  `git diff main -- test/cli test/e2e test/architecture src/cli src/assembly src/ledger package.json` being empty
- [ ] 3.2 Manual acceptance in an empty temporary folder through `node --experimental-strip-types
  <repo>/src/cli/main.ts`: `init`, `import-md` of the fixture, `apply`, `export` (SL-T06), then the same `apply` run
  while a lock file `store/knowledge.jsonl.lock.1` of another owner expiring far ahead is in place; verified by the exit
  codes 0 for the first four and 2 naming `LG-C03` for the last, and no lock file of the CLI left, recorded in the
  impl-PR body
- [ ] 3.3 `npm run typecheck`, `npm test` and `warrant verify s0-store-2`; verified by all three succeeding
