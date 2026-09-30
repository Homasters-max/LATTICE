# 03. Ledger

## Purpose

How records (02) are ordered, stored, verified and changed through the git workflow; apply as the only write path; where run records (06) live; how the `md` files become blocks.

## Stores

| ID | Rule |
|---|---|
| LG-S01 | Each store has one ledger: ordered, append-only. Order is `seq`, a store-wide sequence number. `seq` strictly grows but may have gaps (expired segments, a cut tail); physical offsets exist only inside an adapter. |
| LG-S02 | Storage is behind the `store` port. Adapters: JSONL file, memory (tests). No database until a measurement shows it is needed. One set of contract tests on `store` runs against every adapter; the memory adapter shares one ledger between several writers, so "two writers" and "expired lock" (LG-C06) are tested without a disk. |
| LG-S03 | A project store is a pair of ledgers of the same format: **`knowledge`** — in git, changed only through proposals (blocks, types, decision points, bench sets, status facts); **`runtime`** — local, append-only, in segments (LG-R05): runs with their tapes (PL-R01, PL-K01) and local verdicts. |
| LG-S04 | `runtime` references `knowledge` by `ref@n` plus the knowledge commit hash. |

## Commits

| ID | Rule |
|---|---|
| LG-C01 | A commit is a group of records that passes all hard checks together and is written entirely or not at all. There are no records outside commits; order inside a commit is `seq`. |
| LG-C02 | Header of a `knowledge` commit (a `runtime` commit: LG-R05): `{seq, prev, kernel, base, proposal, by, at}` — `prev` is the hash of the previous commit, `base` the tail the commit was applied on, `proposal` the hash of its intents. |
| LG-C03 | Concurrency: a commit names the `seq` it is written after. If the tail has moved, the commit is rejected and the caller retries. At the logical level there are no locks and no automatic merge; how an adapter serialises appends is LG-C06. |
| LG-C04 | Integrity: every commit carries the hash of the previous one; the chain is verified when a store is opened. A run record cites a `knowledge` commit (LG-S04), so replay can verify nothing was rewritten since. |
| LG-C05 | An empty commit is never written. If every intent is a no-op (OM-H03, TR-F07), apply reports `no-op`, the proposal file is removed, and neither the chain nor `seq` moves. |
| LG-C06 | The JSONL adapter serialises appends with a lock file carrying an owner and a TTL, and checks right before writing that the lock is still its own (fencing). Every append ends with `fsync`. When a store opens, a tail without a commit end marker is moved to `recovered/` and never read. Only a local disk is supported; the adapter warns when `runtime` sits in a folder under git or cloud sync (`knowledge` is in git by design, LG-S03). |
| LG-C07 | Every check of apply sees one state: the tail plus the whole commit. A commit holds at most one intent per entity `id` and per fact key; a second one is rejected. So the result does not depend on the order of intents: any permutation of intents gives the same result, which a permutation test proves. A type and blocks of that type may be written in one commit. |
| LG-C08 | Re-applying a proposal whose hash (LG-C02 `proposal`) is already in the ledger returns that commit and writes nothing. This covers a crash between writing the commit and removing the proposal file (LG-P04). |

```json
{ "seq": 1042, "prev": "sha256:…", "kernel": "1", "base": 1041,
  "proposal": "sha256:…", "by": "<session>", "at": "…",
  "records": [ … ] }
```

## Proposals (git workflow)

The `knowledge` ledger lives in the repository. Only one writer applies to it, and `main` is merged only by the maintainer.

| ID | Rule |
|---|---|
| LG-P01 | A branch never edits the ledger directly. It carries a **proposal**: a list of intents — "write entity X with body …", "write event …". |
| LG-P02 | An entity intent names its expected revision ("X was rev 3"). If X is rev 4 at apply time, the intent is rejected and the author updates the proposal. Events have no base; they are appended. |
| LG-P03 | Apply is the last step in the PR branch, on top of the current `main` tail. Merge is allowed only for a branch up to date with `main`. If `main` moved, the branch syncs and the ledger part is rebuilt from the proposal — never merged by hand. No bot pushes to `main`. |
| LG-P04 | Apply turns the proposal into a ledger commit and removes the proposal file. The commit holds the intents in full; its header holds their hash. |
| LG-P05 | CI checks a PR: (1) the intents apply to the `main` tail without rejection; (2) the ledger commit in the branch equals, byte for byte, the result of re-applying its intents to `base`; (3) the export (`*.md`) equals what is generated from the ledger. A hand edit of the ledger or the export turns CI red. CI only runs apply (LG-A01) and the codec (LG-B05) and compares bytes; it holds no checks of its own. |

## Apply

| ID | Rule |
|---|---|
| LG-A01 | Apply is the only path into `knowledge`. It turns a proposal into a commit, a `no-op` (LG-C05), or a list of rejections. Every hard check on a write (DP-B11) is part of apply. |
| LG-A02 | Every rejection names the ID of the design rule it enforces. A hard check without a rule ID is a defect of the design. A rejection is `{intent, rule, message, path, expected, got}`; for a duplicate it also names the `id` it collided with and the differing paths. Every rule ID has at least one fixture that triggers it. |
| LG-A03 | The kernel (OM-L04) is an internal seam of apply. Above it apply checks: expected revision (LG-P02), tail and `seq` (LG-C03), one intent per key (LG-C07), uniqueness (OM-D01), existence of pinned targets (OM-R03), basis (TR-B02), writers and owner acts (CT-N03, TR-F06), `live` of a decision point or a pipeline (DP-L06), secrets (LG-A06), the hash chain (LG-C04). A change of catalog or trust policy is never a kernel change. |
| LG-A04 | Identity and owner acts reach apply only through the `acts` port. Adapters: `github` (the PR comment or review and the login, CT-A03, CT-P04), `init` (store init, owner from the init configuration, CT-N05), `fixture` (tests), `recorded` (acts stored in a commit). |
| LG-A05 | Acts are checked once, when a commit is admitted; the commit stores the comment URL and the check result as evidence. Re-applying in CI (LG-P05 (2)), opening a store (LG-C04) and rebuilding projections (LG-J02) read acts through the `recorded` adapter and never call GitHub. |
| LG-A06 | Secrets: every value read through `$env` (PL-A02) is registered; apply rejects a record containing any of them and never repeats the value in the rejection. A secret literal in configuration is a refusal at start-up (PL-A03). A canary test plants a fake secret and greps the store, tapes and evidence for it; the result must be empty. PII in blocks is an explicit assumption of v1: the owner is responsible for not writing it. |
| LG-A07 | Genesis, the `std` package and store init go through apply like any other commit (LG-G01, LG-G02, LG-G04). Their exemptions from checks — the self-typed meta-type, a session that has no earlier session event — are named explicitly by rule ID in apply, never guessed from a key. |

## Projections

| ID | Rule |
|---|---|
| LG-J01 | Referrers, latest revision, uniqueness, in-force status (TR-I01), findings (TR-N01) and every other index are projections computed from the ledger — never a source of truth; they can be dropped and rebuilt. |
| LG-J02 | A rebuild yields byte-identical results. Tests check it three ways: an incremental index against a rebuild from scratch; with the list of projections permuted; on two operating systems. Frozen reference ledgers with a verified index are kept in git. Projection code uses no clock, no ids and no order of parallel traversal. |
| LG-J03 | Write-time checks read projections, which must match the ledger tail. |
| LG-J04 | Projections are rebuilt in memory when a store opens. A disk cache is allowed as an optimisation, keyed by the tail hash and the LATTICE version that computed it; on mismatch it is discarded. |
| LG-J05 | The meaning of "in force" and of findings is code of a LATTICE version. A change of that meaning comes only with a new LATTICE version, whose upgrade commit (LG-G02) records the version in the ledger, so it is visible from which `seq` on the new meaning applies. |

## Runtime store

| ID | Rule |
|---|---|
| LG-R01 | `runtime` segments do not expire by default, until a measurement gives a replay horizon. Expiry is an explicit command, never a background process. |
| LG-R02 | Segments cited by calibration, bench sets or findings are never expired: they are published as evidence files in the proposal (`evidence/<hash>.jsonl`), and CI verifies their hashes. Only cited segments go to git, never the whole `runtime`. |
| LG-R03 | CI never calls a live judge. Tests run on the `fixture` and `recorded` adapters (PL-K02); recorded answers live in git. Cross-machine determinism comes from recorded answers; memoization (DP-T03) is a local speed-up and gives determinism within one machine only. |
| LG-R04 | `runtime` reaches `knowledge` only by citation: a proposal cites `runtime` segments as evidence (LG-R02). Until then a `runtime` record has no weight in `knowledge`: it counts for no calibration, no verdict count and no finding. |
| LG-R05 | `runtime` is split into segments. The hash chain runs inside a segment; a segment expires as a whole (LG-R01); a small index keeps the head hash of every segment, so opening the store verifies what remains (LG-C04). A `runtime` commit is one run (PL-R01) and has no `proposal` field. |

## Genesis and kernel versions

| ID | Rule |
|---|---|
| LG-G01 | The first commit is produced by kernel code: the meta-type, written by a genesis session that records itself (participant `machine`, purpose `init`, TR-B02), with `at` = `1970-01-01T00:00:00.000Z`. So the genesis hash is a constant of the kernel version that created the store. A kernel knows the chain of genesis hashes and transition commits of all its predecessors and opens a store whose history is a prefix of that chain. |
| LG-G02 | `std` is loaded by the second commit through apply (LG-A07). The hash of the `std` package is a constant of the LATTICE version, verified when the package is loaded and when a store opens. An update `std@n → @n+1` is a proposal made by the service command `upgrade` of a new LATTICE version (PL-E02); it records that version and goes through a PR with an owner act (CT-A02), like any change to `knowledge`. |
| LG-G03 | A new kernel version appends a separate transition commit. Older records remain valid under the kernel they were written with. History is never rewritten. The mechanics of the transition commit are deferred (LT-01). |
| LG-G04 | Store init writes commits 1–4: genesis (LG-G01), `std` (LG-G02), the project namespace (CT-N05), `setup@1` with its `live` fact (PL-A01). |

## Bootstrap

| ID | Rule |
|---|---|
| LG-B01 | Until the first working slice, `design-next/*.md` is the source, written by hand. |
| LG-B02 | The first slice imports the `md` files into blocks through an ordinary proposal. From then on `md` is export only (DP-B10), and a hand edit turns CI red (LG-P05). |
| LG-B03 | Therefore `md` is written now so that it parses into blocks: one ID — one block (README conventions). |
| LG-B04 | Before S0 the `md` files get one normalization pass to the codec format (LG-B06). The S0 criterion is the round trip of the normalized files: import, then export, gives the same bytes (SL-S0). Normalization writes the ID of every prose block into the `md` once; it is never recomputed, so later imports never shift references. |
| LG-B05 | One codec module holds the whole `md` format: import (`md` → proposal) and export (blocks → `md`). No other code knows the format. |
| LG-B06 | Mapping of `md` to blocks: |

| In `md` | Block |
|---|---|
| a table row with an ID | a block whose project type is given by the table header: one type per distinct header, its columns are the fields |
| an ID | entity `id` `lattice/<ID in lower case>`: `DP-B01` → `lattice/dp-b01` |
| prose without an ID (Purpose, notes under tables) | gets its own ID (`DP-P01`, `OM-P01`, …) once, at normalization (LG-B04), and becomes a `knowledge` block |
| a JSON code block | a block of type `example` (extends `knowledge`) |
| an ID mentioned in text, e.g. "(DP-C04)" | a floating reference (OM-R02) |
| a section | a composition of references and headings (OM-C01) |
| "History", "Depends on" | not blocks: removed by normalization; the ledger keeps history, referrers show dependencies |

| ID | Rule |
|---|---|
| LG-B07 | In S0 import is a service command next to apply (PL-E02), run in a `machine` session with purpose `import`, so its records have basis `derived` (TR-B02). `reviews/` and the review table of the README are not part of the corpus. |

## Depends on (not yet designed)

| Topic | Document |
|---|---|
| several projects, references across projects, `std` imports | resolved: [04-catalog](04-catalog.md) CT-M01…M03, CT-N02 |
| who may apply a proposal, sessions (`by`) | resolved: [04-catalog](04-catalog.md) CT-N03, CT-P01…P05, CT-A03 |

## History

- 2026-09-30 — grilled (19 questions).
- 2026-10-01 — unified-architecture review, grilled: apply as the only write path (LG-A01…A05), one path from `runtime` to `knowledge` (LG-R04), `runtime` segments (LG-R05), codec and normalization for S0 (LG-B04…B07).
- 2026-10-01 — design v0.6 audit, grilled: `seq` gaps (LG-S01), store contract tests (LG-S02), JSONL lock and recovery (LG-C06), one state for all checks of a commit (LG-C07), idempotent re-apply (LG-C08), rejection shape (LG-A02), secrets (LG-A06), named exemptions (LG-A07), rebuild tests (LG-J02), cache key and semantics by LATTICE version (LG-J04, LG-J05), no default expiry (LG-R01), genesis session and kernel chain (LG-G01), `std` hash and `upgrade` (LG-G02), init commits 1–4 (LG-G04), prose IDs written once (LG-B04).
