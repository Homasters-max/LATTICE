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

Issue #57 (slice S0, umbrella #44) makes this the Change `s0-store-2`; done when the same contract test suite is green
on the JSONL and the memory adapter in CI. It continues `s0-store` (spec-PR #89, three spec reviews, the last PROVEN),
ABANDONED in PR #95 after an AREA `CL` collision with `s0-apply-checks` (#56). By the maintainer's decision of
2026-10-02 (https://github.com/Homasters-max/LATTICE/issues/44#issuecomment-5948469748) this Change holds AREA `SR`
only; everything the CLI shows of the store — opening with recovery, the refusal for a held lock, the CLI's TTL, the
skeleton store tests in `test/cli/apply.test.ts` — is Change #98 `s0-store-cli`.

## What Changes

- **JSONL adapter hardened**: every append takes a lock with an owner and an expiry, answers `moved` while another
  writer holds an unexpired lock, takes over an expired one as a compare-and-swap (of two takers at most one wins),
  checks the lock again right before writing (fencing, with a margin of half the TTL), flushes the file to the disk
  before it answers, and releases only its own lock.
- **Recovery, as an option of the adapters**: with recovery on, opening a ledger moves a tail without a commit end
  marker to a new file in `recovered/` next to the ledger file and never reads it again; a tail under an unexpired
  lock of another writer is an append in progress and is left alone. With recovery off — the default, which the CLI
  keeps until #98 turns it on — a torn tail is handed over to the opener as today and an append answers `moved` while
  it exists.
- **Memory adapter** `store-memory`: one in-memory ledger shared by several stores, with the same lock, fencing and
  recovery behaviour, for tests.
- **Contract tests**: one suite runs every behaviour of the `store` port on both adapters; JSONL-only tests cover
  `fsync`, failures of the file system, and a tail cut inside a character.

## Capabilities

### New Capabilities

- `store`: the `store` port as behaviour — reading and appending commits in order, the lock with an owner and a TTL,
  fencing, durable appends of the JSONL adapter, recovery of a torn tail, and the contract tests run on both adapters.

### Modified Capabilities

None. The `cli` spec is unchanged here; its changes are #98.

## Impact

- New code: `src/adapters/store-memory/**`; tests `test/store/**`.
- Changed: `src/adapters/store-jsonl/index.ts`.
- Unchanged: `src/cli/**`, `test/cli/**`, and the shared files of the skeleton (SL-T08) — the `store` port interface
  `src/ledger/ports/store.ts`, the module matrix, the CLI entry and command table, `src/assembly/index.ts`,
  `package.json`. Every test under `test/cli/**` keeps passing unchanged: `assembly` calls `jsonlStore(file)` with the
  defaults, so the CLI gets the lock, fencing and `fsync`, and recovery stays off. No new dependency.
- Files on disk: one lock file `<ledger>.lock.<n>` stays next to the ledger file after the first append, released
  (expired) at rest — lock numbers are never reused, so the greatest one is kept (maintainer's decision on review 1 of
  this Change); for the CLI that is `store/knowledge.jsonl.lock.<n>`, which shows in `git status` until #98 decides its
  place or a `.gitignore`. A temporary lock file `<ledger>.lock.<owner>.tmp` exists for the moment of a take and may be
  left by a crash; `recovered/` appears only after a torn tail was recovered.
- AREA `SR` only (decision above).
- Follow-ups: #98 (`s0-store-cli`), #86 (the port comment on `torn`, a `locked` reason for `append`).

## Non-goals

- The `cli` delta of #89 and the removal of the skeleton store tests in `test/cli/apply.test.ts`: #98.
- The warning of LG-C06 for a `runtime` ledger in a folder under git or cloud sync: S0 has no `runtime` ledger
  (LG-S03, LG-R05 come with S1); issue #84.
- Re-checking the record hashes of every commit when a store opens (design I-19 of `s0-skeleton`): issue #85.
- Segments of `runtime` and their index of head hashes (LG-R05), expiry (LG-R01).
- A new reason in the answer of `append` (e.g. `locked`): the port interface is a shared file of the skeleton
  (SL-T08); issue #86.
- Waiting for a held lock: an append never blocks; the caller retries.
- Network or synced file systems: only a local disk is supported (LG-C06).
- A database adapter (LG-S02: none until a measurement asks for it, LT-11).
