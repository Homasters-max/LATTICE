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
  `append` is a refusal "cannot write store/knowledge.jsonl: <system message>"; a thrown error of `read` is a refusal
  "cannot read store/knowledge.jsonl: <system message>".
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

The interface file is not changed. `append` answers `moved` in four cases: the tail is not `after`; another owner holds
an unexpired lock; another writer took the lock between this store's look and its taking (D-3); the fencing check
fails. All mean "another writer is ahead of you; re-open and retry", which is what LG-C03 asks of the caller, and
`assembly` already refuses `moved` with code 2 naming LG-C03. `read` always returns `torn: null`: the tail is
recovered, or left alone as an append in progress (D-4). The `torn` branch of `openLedger` stays as the refusal for an
adapter that would hand a torn tail over. The port comment that still says a torn tail "is handed over", and a reason
`locked` for a clearer message, go to the small port Change of issue #86.

Rejected: a reason `locked` or `fenced` in `AppendResult` now — a change of the port interface, a separate small Change
by SL-T08, for a message only; a method `recover()` or `open()` on the port — the same, and LG-C06 ties recovery to
opening, which is `read`; waiting for a held lock — a synchronous wait blocks the CLI, and a held lock means another
writer is appending right now, after which this commit's `after` is stale anyway.

### D-2. Adapter options

Both adapters take the same options, each declaring the type itself (an adapter imports no other adapter):

```ts
type StoreOptions = {
  owner?: string;                            // lock owner; default randomUUID() of node:crypto — unique per store
  now?: () => number;                        // integer UTC ms; default Date.now
  ttl?: number;                              // ms; default 10_000
  pause?: (point: "take" | "fence") => void; // test seam, see below
};
jsonlStore(file: string, options?: StoreOptions & { fs?: JsonlFs }): Store;
memoryLedger(): MemoryLedger;
memoryStore(ledger: MemoryLedger, options?: StoreOptions): Store;
```

`assembly` keeps calling `jsonlStore(ledgerFile)`, so the CLI gets the defaults, among them the TTL of 10 000 ms that
REQ-CL-001 states. The store's clock is the adapter's own `now`, not the `clock` port: a lock expiry is never recorded
in the ledger, so it is not a recorded value (PL-K01). The TTL is about four orders of magnitude above one append of a
small line with `fsync` on a local disk, and short enough that a crashed CLI blocks the next command for seconds at
most.

`pause` is the seam that lets a test act as another writer in the middle of an operation: `"take"` — after the store
looked at the current lock and before it takes it (SCN-SR-008, SCN-SR-009, SCN-SR-011); `"fence"` — right before a
fencing check: in an append after the tail check (SCN-SR-004), in a recovery after the copy and before the cut
(SCN-SR-012). It is not a port and has no production caller; LG-S02 names "two writers" and
"expired lock" as what the contract tests must show, and they cannot be shown in one synchronous process without it.

Rejected: the `clock` port for the TTL — `store-*` adapters may import only the `store` interface (REQ-AR-009); timing
tests with real sleeps or child processes — slow and flaky, and still unable to hit the window between two steps.

### D-3. The JSONL lock: lock files created whole, then verified

A lock is a file `<ledger file>.lock.<n>` (REQ-SR-002); the current lock is the greatest `<n>` in a listing of the
folder (`readdirSync`, names matching `^<ledger file name>\.lock\.([1-9][0-9]*)$`).
- Look: list the folder; read the greatest file; the result is `{ n, text }` (or none). The text is a readable lock when
  it is exactly the canonical JSON of `{"expires":<ms>,"owner":"<owner>"}` and a line feed (`JSON.parse`, two keys,
  `owner` a string, `expires` a safe integer, re-serialised text equal to the file); anything else counts as expired.
  `ENOENT` while reading the file means it was removed after the listing: look again. Any other failure is thrown.
- Take: write the content to `<ledger file>.lock.<owner>.tmp`, `fsync`, close; `linkSync(tmp, <ledger file>.lock.<k+1>)`
  where `k` is the `<n>` it looked at (`0` when none) — atomic, fails with `EEXIST` when the name exists, and makes the
  file appear with its whole content; remove the temporary file. `EEXIST` answers `moved`.
- Verify (the second half of the compare-and-swap): look again at the whole listing; the take holds only when the
  greatest file is its own and the greatest *other* file is `{ n: k, text }` exactly as looked at (no other file when it
  looked at none). Otherwise it removes its own file and answers `moved`.
- Fencing: look again; own when the greatest file is its own (same `owner`, the content it wrote) and `now() < expires`.
- Release: list; remove its own file and every lock file with a smaller `<n>`; failures are swallowed (REQ-SR-002). A
  file with a greater `<n>` is never removed.

Why it is safe. A lock file of a live holder H at `<n>` is removed only by H's release, by the release of a holder with a
greater `<n>` — which took the lock only after it looked at H's lock as expired —, or never. While H's file is the
greatest, another writer W either looked at H's lock (unexpired: `moved`), or looked at a stale listing whose greatest
`<k>` is below `<n>`: then W's `<k+1>` collides with an existing name (`EEXIST`), or is below `<n>` and W's verify finds
that its own file is not the greatest. Numbers are reused after a release, but a reused name never carries the same
content (the owner is unique per store and the expiry is part of the content), so the verify of a writer that looked
before the reuse fails (review 2 F-1, interleaving 1: SCN-SR-011). A lock file never appears half-written, so a fresh
lock is never mistaken for an expired one (interleaving 2). Two verifies can both fail (each sees the other's file);
both answer `moved`, which is safe. What remains is the gap between a fencing check and the write or the cut
(REQ-SR-002, Limits).

Rejected: one lock file replaced with `renameSync` — review 1 F-1: two takers of one expired lock both "win"; exclusive
creation of the next number without a verify — review 2 F-1: numbers are reused after a release, and a lock created
with `wx` is visible empty before its content is written; a lock number that never decreases (a marker left at release)
— it closes the reuse but leaves a marker file behind after every command; a rename-aside of the expired lock — a stale
rename can move a fresh lock aside; OS file locks — no portable `flock` in Node without a package; a lock folder
(`mkdir`) — carries no owner or expiry atomically. Hard links exist on NTFS, ext4 and APFS, the local disks LG-C06
means; on FAT or exFAT `linkSync` throws and the command refuses with code 2 (stated in REQ-SR-002).

### D-4. JSONL `read` and recovery

`read` reads the file as bytes (a missing file is empty). The torn tail is the bytes after the last `0x0a`. Without a
torn tail the bytes are decoded as strict UTF-8 and split as today. With one:
1. look at the lock (D-3); an unexpired lock of another owner → return the complete lines only (an append in progress);
2. `pause?.("take")`; take and verify the lock (D-3); `moved` → as in 1;
3. under the lock, read the bytes again and find the torn tail again; when there is none, nothing is moved;
4. otherwise copy: `mkdirSync(recovered/, recursive)`; list it; write the tail bytes to
   `<ledger file name>.<k+1>.torn`, `k` the greatest `<n>` of the names `<ledger file name>.<n>.torn` there, opened with
   `wx` (on `EEXIST`, list again and retry); `fsync`, close; then, except on Windows (`process.platform === "win32"`,
   where Node cannot open a folder), open `recovered/` read-only, `fsync`, close;
5. `pause?.("fence")`; fencing (D-3) and a check that the ledger file still has the size and the tail bytes read in 3;
   when either fails, cut nothing and return the complete lines read in 3 (an append answers `moved`);
6. cut: `openSync(file, "r+")`, `ftruncateSync` to the offset found in 3 — the byte after the last line feed —, `fsync`,
   close;
7. release the lock (D-3) in a `finally` over 3–6; decode and return the complete lines.

A failure in 4–6 is thrown after the release. A crash, a failure or a failed check after the copy and before the cut
leaves the tail in both places; the next opening copies it again into a new file — a duplicate in `recovered/`, never a
loss (SCN-SR-010, SCN-SR-012). The cut is fenced like a write, because a recovering store whose lock was taken over
would otherwise cut at an offset after which the new holder may already have appended a commit answered `ok` (review 2
F-2). An `append` that holds the lock runs steps 3–6 before its tail check.

What the maintainer does with `recovered/`: it is evidence of a cut write, for the maintainer to read and delete; it is
never read by LATTICE and never meant to be committed. A lock file that outlives its command expires by its TTL and is
removed by the release of the next store that takes the lock. A lock file exists while an append runs
or a read recovers a torn tail, and stays after a crash or a failed removal. Neither `init` nor this Change writes a
`.gitignore`; S0 projects have only the throwaway stores of tests
and of manual acceptance (LG-G05).

Rejected: decoding the whole file before finding the tail — a write cut inside a character would make the file
unreadable instead of recoverable; trusting the tail found before taking the lock — review 1 F-2: it may have become a
complete commit answered `ok`; names from the clock (`<name>.<ms>.torn`) — review 1 F-12: they do not sort in recovery
order; `recovered/` under `.lattice/` (local state, LG-S05) — the adapter knows only its ledger file, and a recovered
tail is something the maintainer must see: in `store/` it shows in `git status`.

### D-5. JSONL `append`

1. look at the lock (D-3); an unexpired lock of another owner → `moved`;
2. `pause?.("take")`; take and verify the lock (D-3); `moved` when either fails;
3. read the bytes, recover a torn tail (D-4 steps 3–6; `moved` when its check before the cut fails), compare the `seq`
   of the last line with `after` → `moved` on a mismatch;
4. `pause?.("fence")`;
5. fencing (D-3) → `moved` when the lock is not its own;
6. `openSync(file, "a")` (creates a missing file; a missing folder throws `ENOENT`), `writeSync` in a loop until every
   byte of `text + "\n"` is written, `fsyncSync`, `closeSync`;
7. answer `ok`;

with the release of the lock (D-3) in a `finally` over steps 3–7; a failure of the release is swallowed, so it never
masks the answer or the original error (review 1 F-3). A thrown failure in step 6 leaves the bytes written so far as a
torn tail, or the whole line when `fsync` or `close` failed (REQ-SR-003). File operations go through the `fs` option
(`JsonlFs`, the subset of `node:fs` the adapter uses, default `node:fs`) so a test can record them or fail one
(SCN-SR-005, SCN-SR-010).

### D-6. Memory adapter (`src/adapters/store-memory/index.ts`)

`MemoryLedger` is a plain mutable object exported for tests:

```ts
type MemoryLock = { readonly owner: string; readonly expires: number } | { readonly unreadable: true };
type MemoryLedger = { lines: string[]; torn: string | null; lock: MemoryLock | null; recovered: string[] };
```

`memoryStore` runs D-4 and D-5 over it with the same steps and the same options except `fs`. Every take makes a new,
frozen lock object, and the compare-and-swap compares identities: `ledger.lock === looked ? (ledger.lock = mine) :
moved`; so a lock removed and taken again by another writer is a different object even with the same owner and expiry
(SCN-SR-011). Fencing is `ledger.lock === mine && now() < mine.expires`; release sets `lock = null` when
`ledger.lock === mine`; recovery pushes `torn` onto `recovered`, fences, then sets `torn` to `null`; the write pushes
the text onto `lines`. `seq` is read from each text as the JSONL adapter does
(`JSON.parse`, `NaN` otherwise).

Rejected: the memory adapter as a JSONL adapter over an in-memory file system — it would test the same code twice and
prove nothing about a second adapter (ST-M02).

### D-7. Tests

| Path | Proves |
|---|---|
| `test/store/harness.ts` | one harness per adapter: `make(options)`, `seed(texts)`, `tear(text)`, `completeTorn()`, `lock(owner, expires)`, `unreadableLock()`, `lockOwner()`, `recovered()` (in order), `dispose()`; JSONL on a temporary folder, memory on a `MemoryLedger` |
| `test/store/contract.test.ts` | SCN-SR-001, -002, -003, -004, -006 (text tails), -007, -008, -009, -011, -012 on both adapters, one `describe` per adapter, test names `SCN-SR-0nn [jsonl] …` / `[memory]` |
| `test/store/jsonl.test.ts` | SCN-SR-005 (a recording `fs`, a failing write, `fsync`, lock removal), SCN-SR-006 (the cut UTF-8 character), SCN-SR-010 (a failing `ftruncateSync`) |
| `test/cli/store.test.ts` | SCN-CL-011 (the lock files of another owner, through `run` with the default store), SCN-CL-012 |
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
| I-1 | Taking a lock is a compare-and-swap: JSONL lock files are generations `<ledger>.lock.<n>`, taken by exclusive creation of the next `<n>` (D-3); memory compares the generation it looked at. REQ-SR-002 states it; new SCN-SR-008. | Spec review 1 (`EVID-01M3XRTQ1VXSCPWDCE683GXKZB`), F-1: two takers of one expired lock both wrote with a rename-based takeover. | design, spec review 1 |
| I-2 | Under the lock the torn tail is determined again; a tail completed meanwhile is not moved. REQ-SR-004; new SCN-SR-009; SCN-SR-007 extended. | Review 1, F-2. | design, spec review 1 |
| I-3 | A failure of `fsync` or `close` after the whole line is thrown and the commit stays; a failure to remove the lock is never thrown. REQ-SR-002, REQ-SR-003, REQ-CL-001; SCN-SR-005 extended. | Review 1, F-3, decision D-2 (a) of the review. | design, spec review 1 |
| I-4 | A failure during recovery is thrown, the lock is removed, a duplicate in `recovered/` is possible, never a loss; the CLI refuses with code 2. REQ-SR-004, REQ-CL-001; new SCN-SR-010. | Review 1, F-4. | design, spec review 1 |
| I-5 | The JSONL lock format and "cannot be read as a lock" are in REQ-SR-002; a failure to read the lock is thrown. | Review 1, F-5. | design, spec review 1 |
| I-6 | REQ-CL-001 states the CLI's TTL (10 000 ms) and the takeover of a stopped command's lock; SCN-CL-011 extended with an expired lock. | Review 1, F-6. | design, spec review 1 |
| I-7 | A lock of the store's own owner is taken over like an expired one; SCN-SR-003 extended. | Review 1, F-7. | design, spec review 1 |
| I-8 | `append` creates a missing ledger file; a missing folder is a thrown failure (REQ-SR-001). | Review 1, F-8. | design, spec review 1 |
| I-9 | REQ-CL-004 opens the commits before a tail held by another writer's live lock; "nothing is written by the command" qualifies code 1 and the LG-C04 refusal. | Review 1, F-9, F-10. | design, spec review 1 |
| I-10 | REQ-SR-001 says `read` returns an empty torn tail from both adapters; the port comment and a `locked` reason go to issue #86. | Review 1, F-11, F-16. | design, spec review 1 |
| I-11 | Recovered files are `<ledger>.<n>.torn`, in recovery order by `<n>` (REQ-SR-004). | Review 1, F-12. | design, spec review 1 |
| I-12 | REQ-CL-001: a failure of the store names the ledger file, followed by the message of the operating system as it is. | Review 1, F-13: `assembly` is not changed. | design, spec review 1 |
| I-13 | Clock jumps and the file systems supported are named in REQ-SR-002 and Risks; the intent of `recovered/` and of a leftover lock file is in D-4. | Review 1, F-14, F-15 (INFO). | design, spec review 1 |
| I-14 | The take is create-whole (`linkSync` of a written temporary file) plus a verify that the greatest other lock is the one looked at, with the same content; memory compares lock identities. REQ-SR-002, D-3, D-6; new SCN-SR-011. I-1's exclusive creation alone is replaced. | Spec review 2 (`EVID-01M3XSPNW5GPCGR86073RC305Z`), F-1 BLOCKER: lock numbers are reused after a release and a `wx` lock is visible empty, so two writers could both write. | design, spec review 2 |
| I-15 | Recovery copies the tail, then fences (lock still its own, ledger unchanged), then cuts at the offset found under the lock; a failed check cuts nothing. REQ-SR-004, D-4; new SCN-SR-012. | Review 2, F-2. | design, spec review 2 |
| I-16 | A lock file that disappears while being looked at is looked at again; other failures are thrown (REQ-SR-002). | Review 2, F-3. | design, spec review 2 |
| I-17 | REQ-SR-001 says the writer "took the lock and passed its fencing check" instead of "holds the lock until the write is done". | Review 2, F-4: it contradicted the Limits. | design, spec review 2 |
| I-18 | The lifetime of a lock file is stated in proposal.md Impact and D-4. | Review 2, F-5. | design, spec review 2 |
| I-19 | The copy of a torn tail and its folder are flushed before the cut, except the folder on Windows (REQ-SR-004, D-4). | Review 2, F-6. | design, spec review 2 |
| I-20 | REQ-SR-003: after a failed flush the commit is in the ledger file "unless the machine stops before the file reaches the disk". | Review 2, F-7 (INFO). | design, spec review 2 |

## Risks / Trade-offs

- [The fencing check and the write are two steps] → stated in REQ-SR-002; local disk only (LG-C06); a TTL of 10 s
  against an append of milliseconds; the compare-and-swap of D-3 leaves no other window; the cut of a recovery is
  fenced the same way (D-4).
- [Hard links are required] → NTFS, ext4, APFS have them; on FAT or exFAT taking the lock throws and every append
  refuses with code 2 (REQ-SR-002).
- [Windows cannot flush a folder] → a power loss right after a recovery on Windows may lose the new entry of
  `recovered/`; NTFS journals its metadata, and the cut follows only after the copy itself is flushed.
- [A clock that jumps forward expires a live lock early] → the expired writer then fails fencing unless it is already
  past it; stated in REQ-SR-002.
- [Windows: a lock file or the ledger held open by another process (antivirus, indexer) makes an operation fail with
  `EPERM` or `EBUSY`] → the failure is thrown and the command refuses with code 2 naming the ledger file (REQ-CL-001);
  the next run retries; a failed lock removal is swallowed and expires by TTL.
- [A stale lock blocks for up to the TTL after a crash] → 10 s; the CLI answers code 2 naming LG-C03 meanwhile; the
  message says "the tail of the ledger moved" until issue #86 adds a reason.
- [A recovered tail lands in `store/` under git] → intended: it shows in `git status`; the maintainer reads and deletes
  it (D-4).
- [An `fsync` failure after a complete line leaves the commit and the proposal file] → stated in REQ-CL-001; re-apply
  is idempotent only with LG-C08 (#56).
- [`test/cli/apply.test.ts` is touched by this Change] → only the removals of D-7; D-8 checks the Changes in
  implementation first.

## Migration Plan

None: the ledger format does not change; a ledger written by the skeleton's adapter is read as before. The spec
`store` is created at archive; REQ-CL-001 and REQ-CL-004 of the spec `cli` are replaced by this Change's delta.
