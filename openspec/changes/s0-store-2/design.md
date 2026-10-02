# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/store/spec.md` of this Change. This Change continues `s0-store`
(spec-PR #89, ABANDONED in PR #95): its spec `store` is carried over with the rows I-21…I-26 that review 3 of #89 asked
for, and without the `cli` delta, which is Change #98 (maintainer's decision on #44, comment 5948469748). Today:
- The `store` port (`src/ledger/ports/store.ts`, a shared file of the skeleton, SL-T08) is
  `read(): { commits: StoredCommit[]; torn: string | null }` and
  `append(commit: StoredCommit, after: number): { ok: true } | { ok: false; reason: "moved" }` (skeleton design D-2,
  I-20).
- `src/adapters/store-jsonl/index.ts` reads the whole file as strict UTF-8, splits on `\n`, hands the last line without
  a line feed over as `torn`, and appends with `appendFileSync` after re-reading the tail; `append` answers `moved`
  while a torn tail exists. No lock, fencing, `fsync`, recovery.
- `openLedger` (`src/ledger/commit.ts`) refuses a ledger with `torn !== null` (LG-C04); `assembly` makes one
  `jsonlStore(store/knowledge.jsonl)` per command and maps `moved` to a refusal naming LG-C03.
- Tests under `test/cli/**` expect exactly that: the JSONL unit test under SCN-CL-005 (`read().torn` is the torn text,
  `append` answers `moved` with a torn tail), and the CLI refusing a torn tail naming LG-C04 (SCN-CL-008). This Change
  does not edit `test/cli/**`; #98 does.
- Adapters may import only the interface file of their port, `node:` built-ins and packages (REQ-AR-009); a folder
  `src/adapters/store-<name>/` is an adapter of `store` without any change of the module matrix.

## Goals / Non-Goals

**Goals:**
- LG-C06 in the JSONL adapter without changing a shared file: the port interface, `assembly`, the module matrix and
  `package.json` stay as they are.
- Every test under `test/cli/**` and `test/e2e/**` passes unchanged.
- A memory adapter with the same lock semantics, so that the contract suite proves "two writers", "expired lock" and
  fencing on both adapters with one test code (LG-S02, ST-T01).
- Crash behaviour that can be tested without killing a process: a failure injected into the file system of the JSONL
  adapter.

**Non-Goals:**
- Everything proposal.md, Non-goals, lists.
- Performance: the whole file is read on every `read` and `append`, as in the skeleton (LG-J04 rebuilds in memory).

## Decisions

### D-1. The port stays; a held or lost lock answers `moved`

The interface file is not changed. `append` answers `moved` in five cases: the tail is not `after`; another owner holds
an unexpired lock; another writer took the lock between this store's look and its taking (D-3); the fencing check
fails; recovery is off and a torn tail exists. All mean "the ledger is not where you expected; re-open and retry or
refuse", which is what LG-C03 asks of the caller. With recovery off `read` hands a torn tail over as `torn`, as the port
comment says; with recovery on it returns `torn: null`. A reason `locked` for a clearer message goes to the small port
Change of issue #86.

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
  recover?: boolean;                         // REQ-SR-004; default false (I-27)
  pause?: (point: "take" | "fence") => void; // test seam, see below
};
jsonlStore(file: string, options?: StoreOptions & { fs?: JsonlFs }): Store;
memoryLedger(): MemoryLedger;
memoryStore(ledger: MemoryLedger, options?: StoreOptions): Store;
```

`assembly` keeps calling `jsonlStore(ledgerFile)`, so the CLI gets the lock, fencing and `fsync` with the defaults, and
recovery stays off until #98 turns it on for the CLI with the `cli` delta and the tests it changes. The store's clock is
the adapter's own `now`, not the `clock` port: a lock expiry is never recorded in the ledger, so it is not a recorded
value (PL-K01). The TTL is about four orders of magnitude above one append of a small line with `fsync` on a local
disk, and short enough that a crashed CLI blocks the next command for seconds at most.

`pause` is the seam that lets a test act as another writer in the middle of an operation: `"take"` — after the store
looked at the current lock and before it takes it (SCN-SR-008, SCN-SR-009, SCN-SR-011); `"fence"` — right before a
fencing check: in an append after the tail check (SCN-SR-004), in a recovery after the copy and before the cut
(SCN-SR-012). It is not a port and has no production caller; LG-S02 names "two writers" and "expired lock" as what the
contract tests must show, and they cannot be shown in one synchronous process without it.

Rejected: recovery on by default — it changes what `test/cli/apply.test.ts` (SCN-CL-005, SCN-CL-008) expects, which
this Change may not edit (I-27); the `clock` port for the TTL — `store-*` adapters may import only the `store`
interface (REQ-AR-009); timing tests with real sleeps or child processes — slow and flaky, and still unable to hit the
window between two steps.

### D-3. The JSONL lock: lock files created whole, then verified

A lock is a file `<ledger file>.lock.<n>` (REQ-SR-002); the current lock is the greatest `<n>` in a listing of the
folder (`readdirSync`, names matching `^<ledger file name>\.lock\.([1-9][0-9]*)$`).
- Look: list the folder; read the greatest file; the result is `{ n, text }` (or none). The text is a readable lock when
  it is exactly the canonical JSON of `{"expires":<ms>,"owner":"<owner>"}` and a line feed (`JSON.parse`, two keys,
  `owner` a string, `expires` a safe integer, re-serialised text equal to the file); anything else counts as expired.
  `ENOENT` while reading the file means it was removed after the listing: look again. Any other failure is thrown.
- Take: open `<ledger file>.lock.<owner>.tmp` with `wx` (never truncating a file of that name, which could be linked to
  a lock), write the content, `fsync`, close; `linkSync(tmp, <ledger file>.lock.<k+1>)` where `k` is the `<n>` it looked
  at (`0` when none) — atomic, fails with `EEXIST` when the name exists, and makes the file appear with its whole
  content; remove the temporary file. `EEXIST` answers `moved`.
- Verify (the second half of the compare-and-swap): look again at the whole listing; the take holds only when the
  greatest file is its own and the greatest *other* file is `{ n: k, text }` exactly as looked at (no other file when it
  looked at none). Otherwise it removes its own lock file only — never a smaller one, which may be the lock of the
  writer that won (SCN-SR-011) — and answers `moved`.
- The take runs inside a `try`: a failure thrown after the lock file was created removes the own lock file and the
  temporary file (failures of those removals swallowed), then rethrows (REQ-SR-002).
- Fencing: look again; own when the greatest file is its own (same `owner`, the content it wrote) and
  `now() < expires - ttl / 2` (I-21).
- Release (after a take that held): list; remove its own file and every lock file with a smaller `<n>`; failures are
  swallowed (REQ-SR-002). A file with a greater `<n>` is never removed.

Why it is safe. A lock file of a live holder H at `<n>` is removed only by H's release, by the release of a holder with a
greater `<n>` — which took the lock only after it looked at H's lock as expired —, or never: a take that does not hold
removes only its own file. While H's file is the greatest, another writer W either looked at H's lock (unexpired:
`moved`), or looked at a stale listing whose greatest `<k>` is below `<n>`: then W's `<k+1>` collides with an existing
name (`EEXIST`), or is below `<n>` and W's verify finds that its own file is not the greatest; a stale listing at or
above `<n>` is impossible while H's file exists, and after it is gone costs only liveness. Numbers are reused after a
release, but the verify compares the content, which carries the owner — unique per store — and the expiry, so a writer
that looked before the reuse fails its verify (review 2 of #89, F-1, interleaving 1: SCN-SR-011). A lock file never
appears half-written, so a fresh lock is never mistaken for an expired one (interleaving 2). Two verifies can both fail
(each sees the other's file); both answer `moved`, which is safe. What remains is the gap between a fencing check and
the write or the cut, closed unless that gap exceeds half the TTL (REQ-SR-002, Limits).

Rejected: one lock file replaced with `renameSync` — review 1 of #89, F-1: two takers of one expired lock both "win";
exclusive creation of the next number without a verify — review 2 of #89, F-1: numbers are reused after a release, and
a lock created with `wx` is visible empty before its content is written; a lock number that never decreases (a marker
left at release) — it closes the reuse but leaves a marker file behind after every command; a rename-aside of the
expired lock — a stale rename can move a fresh lock aside; OS file locks — no portable `flock` in Node without a
package; a lock folder (`mkdir`) — carries no owner or expiry atomically. Hard links exist on NTFS, ext4 and APFS, the
local disks LG-C06 means; on FAT or exFAT `linkSync` throws and every append is a thrown failure (REQ-SR-002).

### D-4. JSONL `read` and recovery

`read` reads the file as bytes (a missing file is empty). The torn tail is the bytes after the last `0x0a`. Without a
torn tail the bytes are decoded as strict UTF-8 and split as today. With one and recovery off, the whole file is decoded
as strict UTF-8 (a throw when it is not) and the tail is returned as `torn`, as the skeleton does. With one and recovery
on:
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
leaves the tail in both places, or lets another store copy it too; the next opening copies it again into a new file — a
duplicate in `recovered/`, never a loss, except the folder entry after a power loss on Windows (I-25; SCN-SR-010,
SCN-SR-012). The cut is fenced like a write, because a recovering store whose lock was taken over would otherwise cut at
an offset after which the new holder may already have appended a commit answered `ok` (review 2 of #89, F-2). An
`append` that holds the lock runs steps 3–6 before its tail check.

What the maintainer does with `recovered/`: it is evidence of a cut write, for the maintainer to read and delete; it is
never read by LATTICE and never meant to be committed. A lock file that outlives its command expires by its TTL and is
removed by the release of the next store that takes the lock. A lock file exists while an append runs or a read
recovers a torn tail, and stays after a crash or a failed removal; a temporary lock file left by a crash is inert.
Neither `init` nor this Change writes a `.gitignore`; S0 projects have only the throwaway stores of tests and of manual
acceptance (LG-G05).

Rejected: decoding the whole file before finding the tail — a write cut inside a character would make the file
unreadable instead of recoverable; trusting the tail found before taking the lock — review 1 of #89, F-2: it may have
become a complete commit answered `ok`; names from the clock (`<name>.<ms>.torn`) — review 1 of #89, F-12: they do not
sort in recovery order; `recovered/` under `.lattice/` (local state, LG-S05) — the adapter knows only its ledger file,
and a recovered tail is something the maintainer must see: in `store/` it shows in `git status`.

### D-5. JSONL `append`

1. look at the lock (D-3); an unexpired lock of another owner → `moved`;
2. `pause?.("take")`; take and verify the lock (D-3); `moved` when either fails;
3. read the bytes; a torn tail with recovery off → `moved`; with recovery on, recover it (D-4 steps 3–6; `moved` when
   its check before the cut fails); compare the `seq` of the last line with `after` → `moved` on a mismatch;
4. `pause?.("fence")`;
5. fencing (D-3) → `moved` when the lock is not its own or less than half of the TTL is left;
6. `openSync(file, "a")` (creates a missing file; a missing folder throws `ENOENT`), `writeSync` in a loop until every
   byte of `text + "\n"` is written, `fsyncSync`, `closeSync`;
7. answer `ok`;

with the release of the lock (D-3) in a `finally` over steps 3–7; a failure of the release is swallowed, so it never
masks the answer or the original error (review 1 of #89, F-3). A thrown failure in step 6 leaves the bytes written so
far as a torn tail, or the whole line when `fsync` or `close` failed (REQ-SR-003). File operations go through the `fs`
option (`JsonlFs`, the subset of `node:fs` the adapter uses, default `node:fs`) so a test can record them or fail one
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
(SCN-SR-011). Fencing is `ledger.lock === mine && now() < mine.expires - ttl / 2`; release sets `lock = null` when
`ledger.lock === mine`; with recovery on, recovery pushes `torn` onto `recovered`, fences, then sets `torn` to `null`;
with recovery off, `read` returns `torn` as it is; the write pushes the text onto `lines`. `seq` is read from each text
as the JSONL adapter does (`JSON.parse`, `NaN` otherwise).

Rejected: the memory adapter as a JSONL adapter over an in-memory file system — it would test the same code twice and
prove nothing about a second adapter (ST-M02).

### D-7. Tests

| Path | Proves |
|---|---|
| `test/store/harness.ts` | one harness per adapter: `make(options)`, `seed(texts)`, `tear(text)`, `completeTorn()`, `lock(owner, expires)`, `unreadableLock()`, `lockOwner()`, `recovered()` (in order), `dispose()`; JSONL on a temporary folder, memory on a `MemoryLedger` |
| `test/store/contract.test.ts` | SCN-SR-001, -002, -003, -004, -006 (text tails), -007, -008, -009, -011, -012, -013 on both adapters, one `describe` per adapter, test names `SCN-SR-0nn [jsonl] …` / `[memory]`; the scenarios of REQ-SR-004 with `recover: true` |
| `test/store/jsonl.test.ts` | SCN-SR-005 (a recording `fs`, a failing write, `fsync`, lock removal), SCN-SR-006 (the cut UTF-8 character), SCN-SR-010 (a failing `ftruncateSync`) |

`test/cli/**`, `test/e2e/**` and `test/architecture/rules.test.ts` are not edited and must pass as they are: the CLI's
default store keeps recovery off, and the frozen `ledger.jsonl` fixtures of the rule test have no torn tail.

### D-8. Scope of the implement Run

`--scope src/adapters/store-jsonl/**,src/adapters/store-memory/**,test/store/**,openspec/changes/s0-store-2/**`.

## Decisions on implementation (I-N)

Rows I-1…I-20 come from the three spec reviews of `s0-store` (#89) and are kept as the history of the carried-over
spec; their evidence ids are those of #89.

| ID | Decision | Why | By |
|---|---|---|---|
| I-1 | Taking a lock is a compare-and-swap (first form: exclusive creation of the next lock number); replaced by I-14. | Review 1 of #89 (`EVID-01M3XRTQ1VXSCPWDCE683GXKZB`), F-1. | spec review 1 of #89 |
| I-2 | Under the lock the torn tail is determined again; a tail completed meanwhile is not moved; SCN-SR-009, SCN-SR-007 extended. | Review 1 of #89, F-2. | spec review 1 of #89 |
| I-3 | A failure of `fsync` or `close` after the whole line is thrown and the commit stays; a failure to remove the lock is never thrown; SCN-SR-005 extended. | Review 1 of #89, F-3. | spec review 1 of #89 |
| I-4 | A failure during recovery is thrown, the lock is removed, a duplicate in `recovered/` is possible; SCN-SR-010. | Review 1 of #89, F-4. | spec review 1 of #89 |
| I-5 | The JSONL lock format and "cannot be read as a lock" are in REQ-SR-002; a failure to read the lock is thrown. | Review 1 of #89, F-5. | spec review 1 of #89 |
| I-6 | The CLI's TTL — moved to #98 with the `cli` delta (I-28). | Review 1 of #89, F-6. | spec review 1 of #89 |
| I-7 | A lock of the store's own owner is taken over like an expired one; SCN-SR-003 extended. | Review 1 of #89, F-7. | spec review 1 of #89 |
| I-8 | `append` creates a missing ledger file; a missing folder is a thrown failure (REQ-SR-001). | Review 1 of #89, F-8. | spec review 1 of #89 |
| I-9 | The `cli` wording on opening and "nothing written" — moved to #98 (I-28). | Review 1 of #89, F-9, F-10. | spec review 1 of #89 |
| I-10 | The port comment and a `locked` reason go to issue #86. | Review 1 of #89, F-11, F-16. | spec review 1 of #89 |
| I-11 | Recovered files are `<ledger>.<n>.torn`, in recovery order by `<n>` (REQ-SR-004). | Review 1 of #89, F-12. | spec review 1 of #89 |
| I-12 | The CLI message for a failure of the store — moved to #98 (I-28). | Review 1 of #89, F-13. | spec review 1 of #89 |
| I-13 | Clock jumps and the file systems supported are named in REQ-SR-002 and Risks; the intent of `recovered/` and of a leftover lock file is in D-4. | Review 1 of #89, F-14, F-15 (INFO). | spec review 1 of #89 |
| I-14 | The take is create-whole (`linkSync` of a written temporary file) plus a verify that the greatest other lock is the one looked at, with the same content; memory compares lock identities; SCN-SR-011. | Review 2 of #89 (`EVID-01M3XSPNW5GPCGR86073RC305Z`), F-1 BLOCKER. | spec review 2 of #89 |
| I-15 | Recovery copies the tail, then fences, then cuts at the offset found under the lock; a failed check cuts nothing; SCN-SR-012. | Review 2 of #89, F-2. | spec review 2 of #89 |
| I-16 | A lock file that disappears while being looked at is looked at again; other failures are thrown. | Review 2 of #89, F-3. | spec review 2 of #89 |
| I-17 | REQ-SR-001 says the writer "took the lock and passed its fencing check". | Review 2 of #89, F-4. | spec review 2 of #89 |
| I-18 | The lifetime of a lock file is stated in proposal.md Impact and D-4. | Review 2 of #89, F-5. | spec review 2 of #89 |
| I-19 | The copy of a torn tail and its folder are flushed before the cut, except the folder on Windows. | Review 2 of #89, F-6. | spec review 2 of #89 |
| I-20 | After a failed flush the commit is in the ledger file "unless the machine stops before the file reaches the disk". | Review 2 of #89, F-7 (INFO). | spec review 2 of #89 |
| I-21 | Fencing requires at least half of the TTL left (`now() < expires - ttl / 2`); the Limits of REQ-SR-002 restated; SCN-SR-004 at time 50. | Review 3 of #89 (`EVID-01M3XTN1H01ARD57ZRTD6SA9SK`), F-1 MAJOR. | approval of #89 |
| I-22 | A take that does not hold, or fails after its lock file was created, removes only its own lock file and temporary file; the release (own file and smaller ones) follows only a take that held; SCN-SR-008 names "no lock of A is left". | Review 3 of #89, F-2 MAJOR. | approval of #89 |
| I-23 | The temporary lock file is named in REQ-SR-002 and proposal.md Impact, created with `wx`, removed after the link and on a failed take; a leftover after a crash is inert. | Review 3 of #89, F-3. | approval of #89 |
| I-24 | proposal.md says "of two takers at most one wins". | Review 3 of #89, F-4. | approval of #89 |
| I-25 | "Never loses one" is qualified for a power loss on Windows (REQ-SR-004). | Review 3 of #89, F-5. | approval of #89 |
| I-26 | D-3 "Why it is safe" covers a stale listing at or above a holder's number and bases the reuse argument on the owner in the content. | Review 3 of #89, F-6 (INFO). | approval of #89 |
| I-27 | Recovery is an option of the adapters, off by default; with it off a torn tail is handed over and an append answers `moved` while it exists (REQ-SR-001, SCN-SR-013); #98 turns it on for the CLI. | `test/cli/apply.test.ts` (SCN-CL-005, SCN-CL-008) expects the skeleton's behaviour, and #57 keeps it (maintainer's decision on #44, comment 5948469748). | maintainer's decision on #44 |
| I-28 | The `cli` delta of #89 (REQ-CL-001, REQ-CL-004, SCN-CL-011, the CLI scenario of a recovered torn tail), the CLI's TTL and the removal of the skeleton store tests in `test/cli/apply.test.ts` are Change #98 `s0-store-cli`. | AREA `CL` is held by #56 first; the store starts on `SR` alone. | maintainer's decision on #44 |

## Risks / Trade-offs

- [The fencing check and the write are two steps] → stated in REQ-SR-002; local disk only (LG-C06); a TTL of 10 s, a
  margin of half of it, an append of milliseconds; the compare-and-swap of D-3 leaves no other window; the cut of a
  recovery is fenced the same way (D-4).
- [A clock that jumps forward expires a live lock early] → the expired writer then fails fencing unless it is already
  past it; stated in REQ-SR-002.
- [Hard links are required] → NTFS, ext4, APFS have them; on FAT or exFAT taking the lock throws and every append
  is a thrown failure (REQ-SR-002).
- [Windows cannot flush a folder] → a power loss right after a recovery on Windows may lose the new entry of
  `recovered/`; NTFS journals its metadata, and the cut follows only after the copy itself is flushed (REQ-SR-004).
- [Windows: a lock file or the ledger held open by another process (antivirus, indexer) makes an operation fail with
  `EPERM` or `EBUSY`] → the failure is thrown, and the CLI refuses with code 2 naming the ledger file; a failed lock
  removal is swallowed and expires by TTL.
- [A stale lock blocks for up to the TTL after a crash] → 10 s; the CLI answers code 2 naming LG-C03 meanwhile, with
  the message "the tail of the ledger moved" until #86 adds a reason.
- [Until #98, the CLI does not recover a torn tail] → it refuses the ledger naming LG-C04, as today; the store is
  disposable before the switch (LG-G05).

## Migration Plan

None: the ledger format does not change; a ledger written by the skeleton's adapter is read as before. The spec
`store` is created at archive.
