# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/store/spec.md` and `specs/cli/spec.md` of this Change. Today:
- The `store` port (`src/ledger/ports/store.ts`, a shared file of the skeleton, SL-T08) is
  `read(): { commits: StoredCommit[]; torn: string | null }` and
  `append(commit: StoredCommit, after: number): { ok: true } | { ok: false; reason: "moved" }` (skeleton design D-2,
  I-20).
- `src/adapters/store-jsonl/index.ts` reads the whole file as strict UTF-8, splits on `\n`, hands the last line without
  a line feed over as `torn`, and appends with `appendFileSync` after re-reading the tail. No lock, fencing, `fsync`,
  recovery.
- `openLedger` (`src/ledger/commit.ts`) refuses a ledger with `torn !== null` (LG-C04); `assembly` makes one
  `jsonlStore(store/knowledge.jsonl)` per command and maps `moved` to a refusal naming LG-C03; a thrown error of
  `append` is a refusal naming the file; a thrown error of `read` is a refusal "cannot read".
- Adapters may import only the interface file of their port, `node:` built-ins and packages (REQ-AR-009); a folder
  `src/adapters/store-<name>/` is an adapter of `store` without any change of the module matrix.
- Changes in flight in S0: `s0-kernel` (#55, AREA KR) changes the record hash and moves the `at` formatter out of
  `assembly`; `s0-apply-checks` (#56, AREA LG) grows `ledger`. Neither names the files of this Change.

## Goals / Non-Goals

**Goals:**
- LG-C06 in the JSONL adapter without changing a shared file: the port interface, `assembly`, the module matrix and
  `package.json` stay as they are.
- A memory adapter with the same lock semantics, so that the contract suite proves "two writers", "expired lock" and
  fencing on both adapters with one test code (LG-S02, ST-T01).
- Crash behaviour that can be tested without killing a process: a failure injected into the file system of the JSONL
  adapter.

**Non-Goals:**
- Everything proposal.md, Non-goals, lists.
- Performance: the whole file is read on every `read` and `append`, as in the skeleton (LG-J04 rebuilds in memory).

## Decisions

### D-1. The port stays; a held or lost lock answers `moved`

The interface file is not changed. `append` answers `moved` in three cases: the tail is not `after`; another owner holds
an unexpired lock; the fencing check fails. All three mean "another writer is ahead of you; re-open and retry", which is
what LG-C03 asks of the caller, and `assembly` already refuses `moved` with code 2 naming LG-C03. `read` always returns
`torn: null`: the tail is recovered, or left alone under another writer's live lock (D-4). The `torn` branch of
`openLedger` stays as the refusal for an adapter that would hand a torn tail over.

Rejected: a reason `locked` or `fenced` in `AppendResult` — a change of the port interface, a separate small Change by
SL-T08, for a message only; a method `recover()` or `open()` on the port — the same, and LG-C06 ties recovery to opening,
which is `read`; waiting for a held lock — a synchronous wait blocks the CLI, and a held lock means another writer is
appending right now, after which this commit's `after` is stale anyway.

### D-2. Adapter options

Both adapters take the same options, each declaring the type itself (an adapter imports no other adapter):

```ts
type StoreOptions = {
  owner?: string;            // lock owner; default randomUUID() of node:crypto — unique per store
  now?: () => number;        // integer UTC ms; default Date.now
  ttl?: number;              // ms; default 10_000
  beforeWrite?: () => void;  // test seam: called after the tail check, right before the fencing check (SCN-SR-004)
};
jsonlStore(file: string, options?: StoreOptions & { fs?: JsonlFs }): Store;
memoryLedger(): MemoryLedger;
memoryStore(ledger: MemoryLedger, options?: StoreOptions): Store;
```

`assembly` keeps calling `jsonlStore(ledgerFile)`, so the CLI gets the defaults. The store's clock is the adapter's own
`now`, not the `clock` port: a lock expiry is never recorded in the ledger, so it is not a recorded value (PL-K01).
The TTL of 10 s is about four orders of magnitude above one append of a small line with `fsync` on a local disk, and
short enough that a crashed CLI blocks the next command for seconds at most.

`beforeWrite` is the seam that lets a test run writer B inside writer A's append (fencing, LG-C06; "expired lock" is
named by LG-S02). It is not a port and has no production caller.

Rejected: the `clock` port for the TTL — `store-*` adapters may import only the `store` interface (REQ-AR-009); timing
tests with real sleeps — slow and flaky.

### D-3. The JSONL lock file

- Path `<ledger file>.lock` (`store/knowledge.jsonl.lock`). Content: `{"expires":<ms>,"owner":"<owner>"}` and a line
  feed. A lock is *readable* when its content parses as an object with exactly a string `owner` and a safe integer
  `expires`; otherwise it counts as expired (REQ-SR-002).
- Take, when no lock exists: write the content to `<ledger file>.lock.<owner>.tmp`, then `linkSync(tmp, lock)` — atomic,
  fails with `EEXIST` when a lock exists —, then remove the temporary file. So a lock is never visible half-written.
- Take over, when the lock is expired or unreadable: write the temporary file and `renameSync(tmp, lock)` (atomic
  replace), then read the lock back; when another owner's content is there (two takers raced), the append answers
  `moved`.
- Fencing: read the lock; own when `owner` is this store's and `now() < expires`.
- Release: read the lock; remove it only when `owner` is this store's.

Rejected: `openSync(lock, "wx")` then write — a crash between the two leaves an empty lock that a reader cannot tell
from one being written; OS file locks — Node has no portable `flock`, and they would add a package; a lock folder
(`mkdir`) — carries no owner or expiry atomically.

### D-4. JSONL `read` and recovery

`read` reads the file as bytes (a missing file is empty). The torn tail is the bytes after the last `0x0a`. Without a
torn tail the bytes are decoded as strict UTF-8 and split as today. With one:
1. read the lock; an unexpired lock of another owner → return the complete lines only (an append in progress);
2. otherwise take the lock (D-3; failing to take it → as in 1), re-read the file and recover:
   - create `recovered/` next to the ledger file (`mkdirSync` recursive);
   - write the tail bytes to a new file `<ledger file name>.<now()>.torn`, or `<…>.<now()>-<k>.torn` with the least
     `k ≥ 1` free, opened with flag `wx` so an existing file is never replaced; `fsync` it;
   - cut the ledger to the byte after its last line feed (`ftruncateSync`) and `fsync` it;
3. release the lock; decode and return the complete lines.

A crash after writing the recovered file and before the cut leaves the tail in both places; the next opening recovers it
again into a new file — a duplicate in `recovered/`, never a loss. An `append` that holds the lock runs step 2 before
its tail check.

Rejected: decoding the whole file before finding the tail — a write cut inside a character would make the file
unreadable instead of recoverable; `recovered/` under `.lattice/` (local state, LG-S05) — the adapter knows only its
ledger file, and a recovered tail is something the maintainer must see: in `store/` it shows in `git status`.

### D-5. JSONL `append`

1. take the lock, or answer `moved` (D-3);
2. read the bytes, recover a torn tail (D-4 step 2), compare the `seq` of the last line with `after` → `moved` on a
   mismatch;
3. `beforeWrite?.()`;
4. fencing (D-3) → `moved` when the lock is not its own;
5. `openSync(file, "a")`, `writeSync` in a loop until every byte of `text + "\n"` is written, `fsyncSync`, `closeSync`;
6. answer `ok`;

with step 7, in a `finally`: release the lock (D-3). A thrown failure in step 5 leaves the bytes written so far as a
torn tail (REQ-SR-003). File operations go through the `fs` option (`JsonlFs`, the subset of `node:fs` the adapter uses,
default `node:fs`) so a test can record them or fail one (SCN-SR-005).

### D-6. Memory adapter (`src/adapters/store-memory/index.ts`)

`MemoryLedger` is a plain mutable object exported for tests:
`{ lines: string[]; torn: string | null; lock: { owner: string; expires: number } | "unreadable" | null; recovered: string[] }`.
`memoryStore` runs D-4 and D-5 over it with the same steps and the same options except `fs`: recovery appends `torn` to
`recovered` and sets it to `null`; the write pushes the text onto `lines`. `seq` is read from each text as the JSONL
adapter does (`JSON.parse`, `NaN` otherwise).

Rejected: the memory adapter as a JSONL adapter over an in-memory file system — it would test the same code twice and
prove nothing about a second adapter (ST-M02).

### D-7. Tests

| Path | Proves |
|---|---|
| `test/store/harness.ts` | one harness per adapter: `make(options)`, `seed(texts)`, `tear(text)`, `lock(owner, expires)`, `unreadableLock()`, `lockOwner()`, `recovered()`, `dispose()`; JSONL on a temporary folder, memory on a `MemoryLedger` |
| `test/store/contract.test.ts` | SCN-SR-001, -002, -003, -004, -006 (text tails), -007 on both adapters, one `describe` per adapter, test names `SCN-SR-00n [jsonl] …` / `[memory]` |
| `test/store/jsonl.test.ts` | SCN-SR-005 (a recording and a failing `fs`), SCN-SR-006 (the cut UTF-8 character) |
| `test/cli/store.test.ts` | SCN-CL-011 (the lock of another owner, through `run` with the default store), SCN-CL-012 |
| `test/cli/apply.test.ts` | removed: the JSONL unit test under SCN-CL-005 (now SCN-SR-001), the test "a complete commit without its line feed is named by its seq" and the torn half of "a torn tail and a non-canonical line" under SCN-CL-008 (now SCN-CL-012, SCN-SR-006); nothing else changes |

`test/architecture/rules.test.ts` reads its frozen `ledger.jsonl` fixtures through `jsonlStore(...).read()`; they have
no torn tail, so `read` writes nothing there.

### D-8. Scope of the implement Run

`--scope src/adapters/store-jsonl/**,src/adapters/store-memory/**,test/store/**,test/cli/store.test.ts,test/cli/apply.test.ts,openspec/changes/s0-store/**`.

Before the first commit of the impl-PR the session checks that no Change in implementation names
`test/cli/apply.test.ts` in its scope; if one does, the removals of D-7 wait for that Change's merge and are made on a
rebased branch (an `I-N` row records it).

## Decisions on implementation (I-N)

| ID | Decision | Why | By |
|---|---|---|---|

## Risks / Trade-offs

- [The fencing check and the write are two steps] → stated in REQ-SR-002; local disk only (LG-C06); a TTL of 10 s
  against an append of milliseconds.
- [Windows: `renameSync` over a lock another process has open fails with `EPERM`] → the failure is thrown and the
  command refuses with code 2 naming the file (REQ-CL-001); the next run retries. `linkSync` needs NTFS, the file
  system of a local Windows disk.
- [A stale lock blocks for up to the TTL after a crash] → 10 s; the CLI answers code 2 naming LG-C03 meanwhile.
- [A recovered tail lands in `store/` under git] → intended: it shows in `git status`; the maintainer decides what to do
  with it.
- [`test/cli/apply.test.ts` is touched by this Change] → only the removals of D-7; D-8 checks the Changes in
  implementation first.

## Migration Plan

None: the ledger format does not change; a ledger written by the skeleton's adapter is read as before. The spec
`store` is created at archive; REQ-CL-001 and REQ-CL-004 of the spec `cli` are replaced by this Change's delta.
