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
line feed and its `seq` as read from that text, or not-a-number when the text has no readable number `seq` — and no
torn tail: a tail without a commit end marker is recovered or left alone as REQ-SR-004 says, and is never handed over.
The store does not check that `seq` grows or that the chain holds; the opener does (LG-C04, REQ-CL-004). Physical
offsets never leave the adapter (LG-S01). The JSONL adapter reads a missing file as an empty ledger, and refuses, by
throwing, a ledger whose complete lines are not valid UTF-8.

`append(commit, after)` SHALL write the text of `commit` as the next commit only when the `seq` of the last commit is
`after` (`0` on an empty ledger) and the writer holds the lock until the write is done (REQ-SR-002), and then answer
`ok`; otherwise it SHALL answer `moved` and write nothing (LG-C03). After `ok`, every store made on the ledger reads the
commit. A failure of the file system is thrown and never answered `ok`.

One set of contract tests SHALL run every scenario of REQ-SR-001, REQ-SR-002 and REQ-SR-004 on both adapters with the
same test code, each test named with its scenario token and its adapter (ST-T01); the cases that need bytes no string
can hold, and REQ-SR-003, are JSONL only.

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

### Requirement: Appends are serialised by a lock with an owner and a TTL
<!-- id: REQ-SR-002 -->

An append SHALL take the lock of the ledger before it reads the tail. A lock names its owner — unique to the store
that took it — and its expiry: the time it was taken plus the TTL of the store, in integer UTC milliseconds of the
store's clock. The append takes the lock when the ledger has none, and takes it over when the existing lock has expired
(its expiry is not after the store's current time) or cannot be read as a lock. While another owner holds a lock that
has not expired, the append SHALL answer `moved` and write nothing; it never waits. In the JSONL adapter the lock is a
file next to the ledger file, named as the ledger file with `.lock` appended, and is never visible half-written; in the
memory adapter it is part of the shared ledger.

Fencing: after it has checked the tail and right before it writes, the append SHALL check that the lock is still its
own and has not expired by its clock; if not, it answers `moved` and writes nothing. Whatever the answer, and when a
failure is thrown, the append SHALL remove the lock if it is still its own, and never a lock of another owner.

The check and the write are two steps: a takeover between them is not detected. LG-C06 supports a local disk only, and
the TTL is far above the time of one append, so a takeover needs a writer that stalled for longer than the TTL right
there.

Implements: LG-C06, LG-S02

#### Scenario: A lock left by a stopped writer blocks until it expires
<!-- id: SCN-SR-003 -->
- **WHEN** a ledger holds commit `seq` 1 and a lock of owner `other` expiring at 10000, and a store whose clock reads
  9999 appends commit `seq` 2 after 1; then its clock reads 10000 and it appends the same commit again; then a lock
  that cannot be read as a lock is left on the ledger and the store appends commit `seq` 3 after 2
- **THEN** the first append answers `moved`, the ledger is unchanged and the lock is still `other`'s; the second answers
  `ok`; the third answers `ok`; the ledger holds commits 1, 2 and 3, and no lock is left

#### Scenario: A writer that lost its lock writes nothing
<!-- id: SCN-SR-004 -->
- **WHEN** on a ledger holding commit `seq` 1, store A with TTL 100 takes the lock at time 0 to append its commit `seq`
  2 after 1, and between A's tail check and A's write: store B, at time 100, appends its commit `seq` 2 after 1; then,
  on a fresh ledger holding commit 1, A takes the lock at time 0 and its clock reads 100 between its tail check and its
  write, no other writer acting
- **THEN** B answers `ok` and A answers `moved`; the ledger holds commit 1 and B's commit 2, and no lock is left; in
  the second case A answers `moved`, the ledger holds commit 1 only, and no lock is left

### Requirement: A JSONL append is on the disk before it answers
<!-- id: REQ-SR-003 -->

The JSONL adapter SHALL write the line of a commit and its line feed to the end of the ledger file, flush the file to
the disk (`fsync`), and only then remove its lock and answer `ok` (LG-C06). A failure of the file system during an
append is thrown; the bytes already written stay as a torn tail, which the next opening of the ledger recovers
(REQ-SR-004).

Implements: LG-C06

#### Scenario: An append is flushed before it answers, and a cut write is recovered
<!-- id: SCN-SR-005 -->
- **WHEN** a JSONL store on a ledger holding commit `seq` 1 appends commit `seq` 2 after 1 while the file operations it
  makes are recorded; then, on a fresh ledger holding commit 1, a store whose file system writes the first half of the
  line of commit 2 and then fails appends commit 2 after 1, and a second store reads the ledger and appends commit 2
  after 1
- **THEN** in the first case the line with its line feed is written, then the ledger file is flushed, then the lock is
  removed, then the append answers `ok`; in the second case the first append throws and leaves no lock; the second
  store reads commit 1 only, `recovered/` holds one file with exactly the half line, and its append answers `ok`, after
  which the ledger file is commit 1 and commit 2, each line ended by a line feed

### Requirement: Opening a ledger recovers a torn tail
<!-- id: REQ-SR-004 -->

The torn tail of a ledger is what follows its last commit end marker: in the JSONL adapter, the bytes after the last
line feed — any bytes, valid UTF-8 or not, a complete commit text included. When `read` finds a torn tail and no other
owner holds an unexpired lock, it SHALL take the lock (REQ-SR-002), move the torn tail to a new file in the folder
`recovered/` next to the ledger file — holding exactly its bytes, never replacing an existing file —, cut the ledger
right after its last line feed, flush both files to the disk, remove its lock, and return the commits before the tail.
An append that holds the lock SHALL recover a torn tail the same way before it checks the tail. A torn tail under an
unexpired lock of another owner is an append in progress: `read` SHALL return the commits before it and move nothing,
and an append answers `moved` (REQ-SR-002). A recovered tail is never read again by any store. In the memory adapter the
torn tail is a text after the last commit, and recovered tails are kept, in order, as a list of the shared ledger.

Implements: LG-C06, LG-C04

#### Scenario: A torn tail is moved to recovered/ and never read
<!-- id: SCN-SR-006 -->
- **WHEN** a ledger holds commit `seq` 1 followed by a torn tail — the first 20 characters of the text of a commit
  `seq` 2 —, a store reads it and then appends its commit `seq` 2 after 1; then the text of commit `seq` 3 without its
  line feed is left after commit 2, and a store reads the ledger; then, on the JSONL adapter only, a ledger holding
  commit 1 followed by the first byte of a two-byte UTF-8 character is read
- **THEN** each read returns the commits before the tail and no torn tail; after the first read `recovered/` holds one
  tail equal to the 20 characters, and the append answers `ok`; after the second read it holds a second tail equal to
  the text of commit 3 and still the first one unchanged; no later read returns either tail; the JSONL ledger with the
  cut character reads as commit 1, and `recovered/` gets a file holding exactly that one byte

#### Scenario: A tail under the live lock of another writer is left alone
<!-- id: SCN-SR-007 -->
- **WHEN** a ledger holds commit `seq` 1, a torn tail, and a lock of owner `other` that has not expired, and a store
  reads the ledger, then appends commit `seq` 2 after 1
- **THEN** the read returns commit 1 only; the append answers `moved`; the ledger, its torn tail and the lock of
  `other` are unchanged, and nothing is in `recovered/`
