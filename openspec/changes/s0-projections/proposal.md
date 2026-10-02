# Proposal

## Why

The walking skeleton (`s0-skeleton`, #54) left one projection: the latest revision of every entity
(`src/ledger/projections/latest.ts`), built by `openLedger` from the commits and read by apply and export. Slice S0
also has to prove what LG-J01…J05 say of projections in general: they are computed from the ledger and can be dropped
and rebuilt (LG-J01), a rebuild gives the same bytes — checked incrementally against a rebuild from scratch, with the
list of projections permuted, and on two operating systems, against frozen reference ledgers kept in git (LG-J02) —,
write-time checks read projections that match the tail (LG-J03), and projections are rebuilt in memory when a store
opens (LG-J04). The other projection S0 needs is **referrers** (OM-R05): the reverse index of all references, pinned
and floating, from entities and events — the successors of an entity (OM-I07) and the expansion by edges of S1
(LN-X01, LN-X02) read it. Issue #60 is the Change of AREA `PJ` (launch grilling 2026-10-01, Q4; SL-S0).

Nothing today proves determinism: the view has no serialized form, there is no incremental path to compare with,
no list of projections to permute, and CI runs on one operating system.

## What Changes

- **New spec `projections`** (AREA `PJ`): the read view over the ledger, the references of a record, referrers, the
  incremental extension of a view, its serialized form, and the reference ledgers.
- **The read view** keeps `get` and `entities` and gains `seq` (the tail it was built on), `revision(id, rev)` (every
  revision of an entity, so a pinned reference `id@n` and a type chain resolve) and `referrers(id)`.
- **Referrers (OM-R05)**: the references of a record are its `type` (OM-E02), the roles of `of` of an event (OM-E04)
  and the references its type declares (OM-R02) — read by admitting the body under its type, resolved from the view
  (REQ-KR-013, REQ-KR-014). The sources are the latest revision of every entity and every event; a new revision
  replaces the edges of the one before. An edge is `{from, path, ref}`.
- **Projections as a list**: `latest` and `referrers` are projections over one fold of the revisions; `rebuild(commits,
  list)` gives the same view for every order of the list.
- **Incremental extension (LG-J03)**: `extend(view, commit)` gives a new view, or refuses a commit whose `base` is not
  the `seq` of the view.
- **Serialized form**: `serialize(view)` is the canonical JSON text of the `seq` and of every projection.
- **Reference ledgers (LG-J02)**: `test/fixtures/projections/<case>/ledger.jsonl` with its verified `index.json`; the
  ledger opens and its serialized view equals the index byte for byte — on Linux (job `test`) and on Windows (a new job
  `projections-windows`).
- **`openLedger`** keeps building its view with `latest(commits)` of `projections/latest.ts`, which now gives the full
  view (`rebuild`, LG-J04); `src/ledger/commit.ts` and `src/ledger/index.ts` are not edited.

## Capabilities

### New Capabilities

- `projections`: the read view, references and referrers, incremental extension, the serialized form, the projection
  list and the reference ledgers.

### Modified Capabilities

None. REQ-CL-005 (export reads through the latest-revision projection) and REQ-LG-002…003 (apply reads the latest
revision) keep their wording: `get` and `entities` do not change.

## Impact

- Code: `src/ledger/projections/**` only — new `projection.ts`, `view.ts`, `referrers.ts`; `latest.ts` keeps its
  exports (`latest`, `ReadView`) as the entry `openLedger` and `src/ledger/index.ts` already use. `src/ledger/commit.ts`
  and `src/ledger/index.ts` are not edited: `s0-bootstrap` (#59), in its spec phase in parallel, changes both.
- Tests: new `test/projections/**`; reference ledgers `test/fixtures/projections/**`.
- CI: a new job `projections-windows` in `.github/workflows/test.yml` — a policy path, a maintainer's patch in the
  impl-PR. The job `test` keeps its name, so the required checks of `main` do not change.
- No shared file of the skeleton (module matrix, CLI entry and table, `package.json`, port interfaces) changes.
- Held AREA: `PJ` (comment on umbrella #44 for the paths outside `src/ledger/projections/**`).

## Non-goals

- Uniqueness (OM-D01), in force (TR-I01) and findings (TR-N01) as projections (LG-J01): they come with the Changes of
  their rules (#82, the trust slices).
- LG-J05 — the version of the meaning of in force and of findings: no projection of S0 has a meaning that a LATTICE
  version changes; it is bound to the slice that brings in force and findings (SL-T06).
- A disk cache of projections (LG-J04 allows it as an optimisation; LT-11 is its trigger).
- Resolution through `alias` (OM-R06) and findings of references to retired entities (OM-R04): they need the status
  facts of TR-F05.
- Checks that a referenced target exists (OM-R03, #82): referrers index references, whatever their target.
