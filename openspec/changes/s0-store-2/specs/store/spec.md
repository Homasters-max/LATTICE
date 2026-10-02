# Spec Delta

## Purpose

The `store` port as behaviour: how a ledger is read and appended through its two adapters — a JSONL file and an
in-memory ledger for tests —, how appends of several writers are serialised by a lock with an owner and a TTL, how a
JSONL append is made durable, and how a tail cut by a failure is recovered when a ledger opens.

## ADDED Requirements

### Requirement: The store reads and appends commits in order
<!-- id: REQ-SR-001 -->

A ledger SHALL be read and appended only through the `store` port, served by two adapters: **JSONL** — one file, one
commit per line, each line ended by a line feed, the commit end marker; and **memory** — a ledger held in memory and
shared by every store made on it, used by tests. A store is one writer: two stores made on the same ledger (the same
file, or the same memory ledger) are two writers, each with its own lock owner (REQ-SR-002).

`read` SHALL return the commits of the ledger in the order they were appended — for each commit its text without the
line feed and its `seq` as read from that text, or not-a-number when the text has no readable number `seq` — and the
torn tail, a tail without a commit end marker. Each store is made with recovery on or off, off unless asked. While
another owner holds an unexpired lock (REQ-SR-002), a torn tail is an append in progress: `read` SHALL return the
commits before it and an empty torn tail (`null`), and move nothing, in both modes. Otherwise, with recovery on, the
torn tail returned is empty as well, the tail being recovered as REQ-SR-004 says; with recovery off, `read` SHALL hand
the torn tail over as its text, never as a commit, and move nothing — the opener refuses such a ledger (LG-C04,
REQ-CL-004). The store does not check that `seq` grows or that the chain holds; the opener does. Physical offsets never
leave the adapter (LG-S01). The JSONL adapter reads a missing file as an empty ledger; it refuses, by throwing, a
ledger whose complete lines are not valid UTF-8, and with recovery off also one whose torn tail it hands over is not.

`append(commit, after)` SHALL write the text of `commit` as the next commit only when the `seq` of the last commit is
`after` (`0` on an empty ledger) and the writer took the lock and passed its fencing check (REQ-SR-002), and then answer
`ok`; otherwise it SHALL answer `moved` and write nothing (LG-C03). With recovery off, an append that finds a torn tail
once it holds the lock answers `moved` and writes nothing. After `ok`, every store made on the ledger reads the commit.
The JSONL adapter creates a missing ledger file on the first append; a missing folder of the ledger, and complete
lines that are not valid UTF-8, are thrown failures. A failure of the file system is thrown and never answered `ok`.

A store is made with an owner, a TTL and a clock. The owner is 1 to 64 characters of `A`–`Z`, `a`–`z`, `0`–`9` and
`-`, unique to the store (a fresh one unless given); the TTL is a safe integer of at least 2 milliseconds; the clock
gives integer UTC milliseconds. Making a store with another owner or TTL is refused by throwing; a clock reading that
is not a safe integer is a thrown failure of the operation that read it.

One set of contract tests SHALL run every scenario of REQ-SR-001, REQ-SR-002 and REQ-SR-004 on both adapters with the
same test code, each test named with its scenario token and its adapter (ST-T01); the cases that need bytes no string
can hold or a failing file system, and REQ-SR-003, are JSONL only. SCN-SR-013 runs with recovery off, every other
scenario with recovery on.

Implements: LG-S01, LG-S02, LG-C03, ST-T01

#### Scenario: A commit appended after the tail is read back
<!-- id: SCN-SR-001 -->
- **WHEN** a store on an empty ledger reads it, appends commit `seq` 1 after 0, appends another commit after 0, then
  appends commit `seq` 2 after 1; and a second store made on the same ledger reads it
- **THEN** the first read gives no commits; the answers are `ok`, `moved`, `ok`; both stores then read exactly the
  commits `seq` 1 and 2 with their texts, in that order; the commit answered `moved` is nowhere in the ledger

#### Scenario: Two writers append after the same tail
<!-- id: SCN-SR-002 -->
- **WHEN** two stores on a ledger holding commit `seq` 1 both read it, then the first appends its commit `seq` 2 after
  1, then the second appends its own commit `seq` 2 after 1
- **THEN** the first answers `ok` and the second `moved`; the ledger holds commit 1 and the first writer's commit 2
  only

#### Scenario: With recovery off a torn tail is handed over
<!-- id: SCN-SR-013 -->
- **WHEN** a ledger holds commit `seq` 1 followed by a torn tail — the first 20 characters of the text of a commit
  `seq` 2 —, with no unexpired lock, and a store made with recovery off reads it and then appends commit `seq` 2 after
  1; then a lock of owner `other` that has not expired is left on the ledger and the store reads it again
- **THEN** the first read returns commit 1 and the 20 characters as the torn tail; the append answers `moved`; the
  second read returns commit 1 and no torn tail; the ledger is unchanged throughout, there is no recovered tail, and no
  unexpired lock of the store is left

### Requirement: Appends are serialised by a lock with an owner and a TTL
<!-- id: REQ-SR-002 -->

An append SHALL take the lock of the ledger before it reads the tail. A lock names its owner — unique to the store that
took it — and its expiry: the time it was taken plus the TTL of the store, in integer UTC milliseconds of the store's
clock. The store first looks at the current lock. While another owner holds a lock that has not expired (its expiry is
after the store's current time), the append SHALL answer `moved` and write nothing; it never waits. Otherwise — no lock,
an expired lock, a lock that cannot be read as a lock, or a lock of its own — it takes the lock. Taking is a
compare-and-swap over the whole lock: it succeeds only when, once the store's lock is in place, the lock it replaces is
still exactly the one the store looked at — the same lock, not merely one in the same place — and no other writer took
a lock in between; otherwise the append SHALL answer `moved`, write nothing and leave no lock of its own.

In the JSONL adapter a lock is a file next to the ledger file, named as the ledger file followed by `.lock.<n>`, `<n>` a
positive decimal integer without leading zeros; the current lock is the file with the greatest `<n>`, and there is no
lock when there is no such file. The content of a lock file is the canonical JSON of an object with exactly a string
`owner` and a safe integer `expires`, followed by a line feed (`{"expires":10000,"owner":"a"}`); a lock file appears
and changes only with its whole content, so any other content cannot be read as a lock and counts as expired. A lock
file whose `<n>` is the greatest is removed only by the store that created it, when its take did not hold; so a number
under which a take held never becomes the greatest again once a greater one exists, and never holds the take of
another store.

Taking the lock writes the content to a temporary file next to the ledger file, named as the ledger file followed by
`.lock.<owner>.tmp`, then creates, whole, the lock file with `<n>` one more than the greatest `<n>` the store looked at
(`1` when there was none) — failing when that file already exists —, removes the temporary file, and then looks again:
the take holds only when its own file is the current lock and the greatest other lock file is the one it looked at,
with the same content (none when it looked at none). A take that holds SHALL then remove every lock file with a smaller
`<n>`. A take that does not hold, or that fails with a thrown failure after its lock file was created, SHALL remove its
own lock file and its temporary file, and no other file. When the temporary file already exists, or writing it fails,
the take is a thrown failure that leaves no lock file of its own; a failure to remove the temporary file after the
lock file was created is not thrown, and the file is left. A temporary file is never read by another store and never
taken for a lock. A lock file that disappears while the store looks at it is looked at again; any other failure of the
file system while looking at the lock is thrown, never taken for an expired lock. In the memory adapter the lock is a
value of the shared ledger, and the compare-and-swap compares the lock value itself.

Fencing: right before it writes, the append SHALL check that the current lock is still its own and that at least half
of its TTL is left (its clock reads before the expiry minus half the TTL); if not, it answers `moved` and writes
nothing.

Release: once its take held, whatever the answer, and when a failure is thrown, the append SHALL release its lock. In
the JSONL adapter a release replaces the content of the store's own lock file, whole, by an expired lock of its owner
(`expires` 0); it never removes a lock file and never writes another store's lock file. When a later store removed
that file meanwhile, the release leaves a released lock file with a smaller `<n>`, which the next take removes. So at
rest one released lock file stays next to the ledger file; "no lock is left", in the scenarios below, means no lock
that has not expired. In the memory adapter a release clears the lock when it is still the store's own.
A failure to release is never thrown: the lock then stays until it expires and the next store takes it over.

Limits: the fencing check and the write (or the cut of REQ-SR-004) are two steps, and a takeover between them is not
detected — it needs the time from the fencing check to the end of the write or cut to exceed half the TTL; a recovery
that always takes longer than that never cuts its tail and adds a copy to `recovered/` at every opening. An expiry
written by one process is compared with the clock of another, so a clock that jumps forward can expire a live lock
early. Only a local disk whose file system has hard links is supported (LG-C06); on another file system taking the
lock is a thrown failure.

Implements: LG-C06, LG-S02

#### Scenario: A lock left by a stopped writer blocks until it expires
<!-- id: SCN-SR-003 -->
- **WHEN** a ledger holds commit `seq` 1 and a lock of owner `other` expiring at 10000, and a store whose clock reads
  9999 appends commit `seq` 2 after 1; then its clock reads 10000 and it appends the same commit again; then a lock
  that cannot be read as a lock is left on the ledger and the store appends commit `seq` 3 after 2; then a lock of the
  store's own owner expiring at 20000 is left on the ledger and the store appends commit `seq` 4 after 3
- **THEN** the first append answers `moved`, the ledger is unchanged and the lock is still `other`'s; the second, third
  and fourth answer `ok`; the ledger holds commits 1, 2, 3 and 4, and no lock is left

#### Scenario: A writer that lost its lock writes nothing
<!-- id: SCN-SR-004 -->
- **WHEN** on a ledger holding commit `seq` 1, store A with TTL 100 takes the lock at time 0 to append its commit `seq`
  2 after 1, and between A's tail check and A's write: store B, at time 100, appends its commit `seq` 2 after 1; then,
  on a fresh ledger holding commit 1, A takes the lock at time 0 and its clock reads 50 — half of its TTL left —
  between its tail check and its write, no other writer acting
- **THEN** B answers `ok` and A answers `moved`; the ledger holds commit 1 and B's commit 2, and no lock is left; in
  the second case A answers `moved`, the ledger holds commit 1 only, and no lock is left

#### Scenario: Two writers take over one expired lock
<!-- id: SCN-SR-008 -->
- **WHEN** a ledger holds commit `seq` 1 and an expired lock of owner `other`; store A looks at that lock to append its
  commit `seq` 2 after 1, and between A's look and A's taking of the lock another writer takes over the same expired
  lock and still holds it, unexpired
- **THEN** A answers `moved`; the ledger holds commit 1 only; the lock of the other writer is unchanged; no lock of A is
  left

#### Scenario: A lock replaced in its place is not taken over
<!-- id: SCN-SR-011 -->
- **WHEN** a ledger holds commit `seq` 1 and an expired lock of owner `other`; store A looks at that lock to append its
  commit `seq` 2 after 1, and between A's look and A's taking of the lock every lock of the ledger is removed and a
  writer `c` takes a new lock that has not expired, in the place of the first one (in the JSONL adapter, the file with
  the same `<n>`)
- **THEN** A answers `moved`; the ledger holds commit 1 only; the lock of `c` is unchanged and is the current lock; no
  lock of A is left

#### Scenario: A writer that lost its lock leaves the next holder's lock alone
<!-- id: SCN-SR-014 -->
- **WHEN** on a ledger holding commit `seq` 1, store A with TTL 100 takes the lock at time 0 to append its commit `seq`
  2 after 1, and between A's tail check and A's write: store B, at time 100, appends its commit `seq` 2 after 1, and
  then a writer `c` takes the lock and holds it, unexpired
- **THEN** A answers `moved`; the ledger holds commit 1 and B's commit 2; the lock of `c` is unchanged and is the
  current lock

### Requirement: A JSONL append is on the disk before it answers
<!-- id: REQ-SR-003 -->

The JSONL adapter SHALL write the line of a commit and its line feed to the end of the ledger file, flush the file to
the disk (`fsync`), and only then release its lock (REQ-SR-002) and answer `ok` (LG-C06). A failure of the file system during an
append is thrown. When it comes before the whole line and its line feed are written, the bytes already written stay as a
torn tail, which the next opening of the ledger with recovery on recovers (REQ-SR-004), and which a store with recovery
off hands over (REQ-SR-001). When it comes after — while flushing or closing
the file —, the commit is in the ledger file and later reads return it, unless the machine stops before the file reaches
the disk.

Implements: LG-C06

#### Scenario: An append is flushed before it answers, and a failing append is thrown
<!-- id: SCN-SR-005 -->
- **WHEN** a JSONL store on a ledger holding commit `seq` 1 appends commit `seq` 2 after 1 while the file operations it
  makes are recorded; then, on a fresh ledger holding commit 1: a store whose file system writes the first half of the
  line of commit 2 and then fails appends commit 2 after 1, and a second store, with recovery on, reads the ledger and
  appends commit 2 after 1; then, on a fresh ledger holding commit 1, a store whose flush fails appends commit 2 after
  1; then, on a fresh ledger holding commit 1, a store whose release of its lock fails appends commit 2 after 1, and a
  store whose clock is past the TTL of that lock appends commit 3 after 2
- **THEN** in the first case the line with its line feed is written, then the ledger file is flushed, then the lock is
  released, then the append answers `ok`; in the second the first append throws and leaves no lock, the second store
  reads commit 1 only, `recovered/` holds one file with exactly the half line, and its append answers `ok`, after which
  the ledger file is commit 1 and commit 2, each line ended by a line feed; in the third the append throws, leaves no
  lock, and a read returns commits 1 and 2; in the fourth the append answers `ok` and its lock file stays, and the
  later append answers `ok`, leaving commits 1, 2 and 3 and no lock

### Requirement: Opening a ledger recovers a torn tail
<!-- id: REQ-SR-004 -->

The torn tail of a ledger is what follows its last commit end marker: in the JSONL adapter, the bytes after the last
line feed — any bytes, valid UTF-8 or not, a complete commit text included; in the memory adapter, a text after the last
commit. This requirement holds for a store made with recovery on (REQ-SR-001). When `read` finds a torn tail and no
other owner holds an unexpired lock, it SHALL take the lock (REQ-SR-002)
and read the ledger again: the torn tail is what then follows the last commit end marker, and when nothing does — the
append that was writing it has completed — nothing is moved. Otherwise it SHALL copy the torn tail out of the ledger,
holding exactly its bytes, and flush the copy to the disk; then, right before cutting, check that the lock is still its
own with at least half of its TTL left and that the ledger is still exactly what it read under the lock (fencing,
REQ-SR-002); then cut the
ledger at the offset found under the lock — right after the last line feed —, flush it, release its lock, and return the
commits before the tail. When that check fails it cuts nothing and returns the commits before the tail as it read
them; the copy stays. When it cannot take the lock, or another owner holds an unexpired one, the torn tail is an append
in progress: `read` SHALL return the commits before it and move nothing, and an append answers `moved`. An append that
holds the lock SHALL recover a torn tail the same way before it checks the tail, and answers `moved` when the check
before the cut fails.

The JSONL adapter copies a torn tail to a new file in the folder `recovered/` next to the ledger file, named as the
ledger file followed by `.<n>.torn`, `<n>` one more than the greatest `<n>` there (`1` for the first), never replacing
an existing file; the order of `<n>` is the order of recovery. It flushes that file, and the folder `recovered/` where
the operating system allows a folder to be flushed (not on Windows), before the cut. The memory adapter keeps recovered
tails, in the order of recovery, as a list of the shared ledger. A recovered tail is never read again by any store.

A failure of the file system during recovery is thrown, and the store releases its lock as REQ-SR-002 says. A failure,
or a failed check, after the copy is written and before the ledger is cut may leave the tail in the ledger too, or let
another store recover it as well; so `recovered/` may hold the same tail twice and never loses one — except after a
power loss on Windows, where the new entry of `recovered/` itself may be lost because a folder cannot be flushed there.

Implements: LG-C06, LG-C04

#### Scenario: A torn tail is moved to recovered/ and never read
<!-- id: SCN-SR-006 -->
- **WHEN** a ledger holds commit `seq` 1 followed by a torn tail — the first 20 characters of the text of a commit
  `seq` 2 —, a store reads it and then appends its commit `seq` 2 after 1; then the text of commit `seq` 3 without its
  line feed is left after commit 2, and a store reads the ledger; then, on the JSONL adapter only, a ledger holding
  commit 1 followed by the first byte of a two-byte UTF-8 character is read
- **THEN** each read returns the commits before the tail and no torn tail; after the first read the recovered tails are
  the 20 characters, and the append answers `ok`; after the second read they are the 20 characters, then the text of
  commit 3; no later read returns either tail; the JSONL ledger with the cut character reads as commit 1, and
  `recovered/` gets a file holding exactly that one byte

#### Scenario: A tail under the live lock of another writer is left alone
<!-- id: SCN-SR-007 -->
- **WHEN** a ledger holds commit `seq` 1, a torn tail, and a lock of owner `other` that has not expired, and a store
  reads the ledger, then appends commit `seq` 2 after 1; then the torn tail gains its line feed, becoming commit `seq`
  2 of `other`, the lock of `other` is removed, and the store reads the ledger again
- **THEN** the first read returns commit 1 only; the append answers `moved`; the ledger, its torn tail and the lock of
  `other` are unchanged, and there is no recovered tail; the last read returns commits 1 and 2, and there is still no
  recovered tail

#### Scenario: A tail that completes before the lock is taken is not moved
<!-- id: SCN-SR-009 -->
- **WHEN** a ledger holds commit `seq` 1 and a torn tail with no lock, and between a store's look at the lock and its
  taking of the lock the torn tail gains its line feed, becoming commit `seq` 2
- **THEN** the read returns commits 1 and 2; there is no recovered tail; no lock is left

#### Scenario: A failed recovery is thrown and repeated at the next opening
<!-- id: SCN-SR-010 -->
- **WHEN** a JSONL ledger holds commit `seq` 1 and a torn tail, and a store whose file system fails to cut the ledger
  reads it; then a store reads it again
- **THEN** the first read throws and leaves no lock; `recovered/` holds one file with the bytes of the tail, and the
  ledger file is unchanged; the second read returns commit 1 only, `recovered/` holds two files with the same bytes,
  and the ledger file ends with the line feed of commit 1

#### Scenario: A recovery that lost its lock cuts nothing
<!-- id: SCN-SR-012 -->
- **WHEN** a ledger holds commit `seq` 1 and a torn tail with no lock; store R with TTL 100 reads it at time 0, takes
  the lock and copies the tail out, and between the copy and R's cut store W, at time 100, appends its commit `seq` 2
  after 1
- **THEN** W answers `ok`; R's read returns commit 1 only and R cuts nothing; the ledger holds commits 1 and 2, each
  ended by its commit end marker; the recovered tails are the torn tail twice; no lock is left
