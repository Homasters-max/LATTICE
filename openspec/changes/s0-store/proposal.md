# Proposal

## Why

The walking skeleton (`s0-skeleton`, #54) left the `store` port with one minimal adapter: a JSONL file appended with no
lock, no fencing, no `fsync` and no recovery. Two writers can both append after the same tail, a crash in the middle of
an append leaves a line without its end marker that makes every later command refuse the ledger, and nothing proves a
second adapter would behave the same. `design-next` asks for more before the switch (SL-T07) puts the design into the
ledger:

- LG-S01, LG-S02 — one ordered, append-only ledger behind the `store` port, with two adapters, JSONL and memory, and
  one set of contract tests run against both; the memory adapter shares one ledger between several writers so that
  "two writers" and "expired lock" are tested without a disk.
- LG-C06 — the JSONL adapter serialises appends with a lock file carrying an owner and a TTL, checks right before
  writing that the lock is still its own (fencing), ends every append with `fsync`, and moves a tail without a commit
  end marker to `recovered/` when the store opens; LG-C04 — the chain is verified when a store opens, on what remains.
- ST-T01 — one set of contract tests per port runs against every adapter of that port.

Issue #57 (slice S0, umbrella #44) makes this the Change `s0-store`; done when the same contract test suite is green on
the JSONL and the memory adapter in CI.

## What Changes

- **JSONL adapter hardened**: every append takes a lock with an owner and an expiry, answers `moved` while another
  writer holds an unexpired lock, takes over an expired one as a compare-and-swap (of two takers only one wins), checks the lock again right before writing (fencing),
  flushes the file to the disk before it answers, and releases only its own lock.
- **Recovery**: opening a ledger moves a tail without a commit end marker to a new file in `recovered/` next to the
  ledger file and never reads it again; a tail under an unexpired lock of another writer is an append in progress and
  is left alone.
- **Memory adapter** `store-memory`: one in-memory ledger shared by several stores, with the same lock, fencing and
  recovery behaviour, for tests.
- **Contract tests**: one suite runs every behaviour of the `store` port on both adapters; JSONL-only tests cover
  `fsync`, a write cut by a failure, and a tail cut inside a character.
- **CLI**: `apply` and `export` open a ledger with a torn tail by recovering it instead of refusing it; a ledger whose
  lock another writer holds is refused like a moved tail (LG-C03).

## Capabilities

### New Capabilities

- `store`: the `store` port as behaviour — reading and appending commits in order, the lock with an owner and a TTL,
  fencing, durable appends of the JSONL adapter, recovery of a torn tail, and the contract tests run on both adapters.

### Modified Capabilities

- `cli`: REQ-CL-001 (a failure of the file system during a write, a held lock among the refusals, opening is not a
  write of the command) and REQ-CL-004 (opening recovers a torn tail before the chain check; `moved` covers a held or
  lost lock; new scenario SCN-CL-012; SCN-CL-011 extended).

## Impact

- New code: `src/adapters/store-memory/**`; tests `test/store/**`.
- Changed: `src/adapters/store-jsonl/index.ts`; in `test/cli/apply.test.ts` only the removal of the tests that expect
  the skeleton's store — the JSONL unit test under SCN-CL-005 and the torn-tail tests under SCN-CL-008 — whose
  behaviour moves to the contract tests and to a new file `test/cli/store.test.ts` (SCN-CL-011's held lock,
  SCN-CL-012).
- Unchanged shared files (SL-T08): the `store` port interface `src/ledger/ports/store.ts`, the module matrix, the CLI
  entry and command table, `src/assembly/index.ts`, `package.json`. No new dependency.
- Files on disk: a lock file `store/knowledge.jsonl.lock.<n>` exists while an append runs (and after a crash, until
  its TTL); `store/recovered/` appears only after a torn tail was recovered, and shows in `git status` so the
  maintainer sees that a write was cut.
- Follow-ups opened from the spec review: issue #86 (the port comment on `torn`, a `locked` reason for `append`).
- AREAs: `SR` (new spec `store`) and `CL` (decision on umbrella #44,
  https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5947346075).

## Non-goals

- The warning of LG-C06 for a `runtime` ledger in a folder under git or cloud sync: S0 has no `runtime` ledger
  (LG-S03, LG-R05 come with S1); issue #84.
- Re-checking the record hashes of every commit when a store opens (design I-19 of `s0-skeleton`): the record hash
  changes with OM-H01 in `s0-kernel` (#55); the chain check of LG-C04 stays as it is; issue #85.
- Segments of `runtime` and their index of head hashes (LG-R05), expiry (LG-R01).
- A new reason in the answer of `append` (e.g. `locked`): the port interface is a shared file of the skeleton
  (SL-T08); `moved` already tells the caller to retry (LG-C03).
- Waiting for a held lock: an append never blocks; the caller retries.
- Network or synced file systems: only a local disk is supported (LG-C06).
- A database adapter (LG-S02: none until a measurement asks for it, LT-11).
