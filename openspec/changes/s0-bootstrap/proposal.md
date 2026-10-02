# Proposal

## Why

`lattice init` creates an empty ledger today (REQ-CL-002: "genesis, `std` and the namespace commit are not written by
`init`"), so the store holds no type, no namespace and no `setup`, every record has the same unnamed standing, and the
`acts` port (`src/ledger/ports/acts.ts`) has no adapter and no caller. Slice S0 proves the bootstrap: genesis and `std`
(LG-G01…G04), the project namespace (CT-N05), the basis table (TR-B02), the `live` fact (TR-F05) and the `setup` type
(PL-A01) (SL-S0). Issue #59 is that Change (launch grilling 2026-10-01, Q4); it also brings the adapters of the `acts`
port — `init`, `fixture`, `recorded`, `github` (LG-A04, LG-A05, CT-A03, CT-A05) — which store init needs for its owner
act and the switch (SL-T07 (4)) needs for CI.

## What Changes

- **Genesis (LG-G01, OM-L01)**: a constant genesis proposal — the meta-type `core/type` (REQ-KR-016), the session event
  type `core/session` and the genesis session event, `machine` / `init`, with a constant `id` and `at`
  `1970-01-01T00:00:00.000Z` — applied on an empty ledger gives commit 1, whose hash is a constant of kernel version
  `0`.
- **The `std` package (LG-G02, OM-L02)**: the folder `std/` (LG-S05) holds the S0 package — the types `std/namespace`
  (CT-N01, CT-N03), `std/setup` (PL-A01) and `std/live` (TR-F05) — whose hash is a constant of the code; it is loaded
  by commit 2 in a `machine` / `init` session.
- **Store init (LG-G04, LG-A07, CT-N05, PL-A01)**: `lattice init` writes commits 1–4 through apply — genesis, `std`,
  the project namespace `<namespace>/namespace` with the owner of the init configuration, and `<namespace>/setup` at
  revision 1 with its `live` fact — the owner's act on commits 2–4 coming through the `init` adapter of `acts`.
- **Reserved namespaces (CT-N02, LG-A07)**: a new apply rule `CT-N02` rejects an intent whose `id` is in `core` or
  `std`; the only exemptions are named by rule ID — `LG-G01` (the genesis proposal on an empty ledger) and `LG-G02`
  (the `std` package right after genesis).
- **Acts in apply (LG-A04, LG-A05)**: apply takes the acts read through the `acts` port; a commit stores the acts that
  confirm its intents as its act record (`acts`, absent when there is none).
- **Basis (TR-B02)**: the basis of every record of a commit is a pure function of its commit — the session event and
  the act record — by the table of TR-B02, in the module `trust`.
- **Facts (TR-F05, TR-F02)**: the current value of a fact key, and so the one `live` revision per entity `id`, is a
  pure function of the fact events in ledger order.
- **Namespace policy (CT-N01, CT-A05)**: the namespace entity and its policy `owner`, `writers`, `owner_acts`; the logins
  whose acts count are the writers listed by name.
- **Adapters of `acts` (LG-A04, LG-A05, CT-A03, CT-A05, ST-T01)**: `init` (the owner from the init configuration),
  `fixture` (acts written in tests), `recorded` (the act records of stored commits) and `github` (issue comments and
  reviews of a pull request, checked for author, text and PR number, read through an injected transport), with one
  contract test run against all four.
- **Opening a store (LG-G01, LG-G02, LG-G03)**: a store whose commit 1 is not the genesis of kernel `0`, whose commit 2
  is not the `std` package, or that holds a commit of another kernel version is refused.

## Capabilities

### New Capabilities

- `trust`: the basis table (TR-B02) and the current value of a fact key with the `live` fact (TR-F02, TR-F05).
- `acts`: the `acts` port contract and its adapters `init`, `fixture`, `recorded`, `github`.
- `catalog`: the namespace entity and its policy (CT-N01, CT-N03 form, CT-A05 logins) and the project namespace created
  by store init (CT-N05).

### Modified Capabilities

- `ledger`: REQ-LG-002 (the rule `CT-N02` and its exemptions), REQ-LG-003 (apply takes acts; the commit's act record),
  REQ-LG-005 (the permutation cases gain acts and the init proposals); new requirements for genesis, the `std`
  package, the init proposals, the basis of records, and the opening checks of a store.
- `cli`: REQ-CL-001 (code 2 for a store outside the genesis chain and a refused `std` package), REQ-CL-002 (`init`
  builds commits 1–4 in memory, then writes them), REQ-CL-003 (the stems `namespace` and `setup` are refused; its
  scenario runs on a store that holds the init commits) and REQ-CL-004 (its scenarios run on that store; a separate
  step "Opening a store" checks the genesis chain).

## Impact

- Code: `src/trust/**`; `src/ledger/{apply,commit,rules,records,proposal,index}.ts` and new
  `src/ledger/{genesis,std,init,basis}.ts`;
  new adapters `src/adapters/acts-{init,fixture,recorded,github}/`; the `init`, `apply` and opening paths of
  `src/assembly/index.ts`; `src/cli/commands/init.ts`; the package `std/std.json`.
- Tests: new `test/trust/**`, `test/acts/**`, `test/ledger/{genesis,init,basis}.test.ts`, a rule fixture
  `test/fixtures/rules/CT-N02/`; changed `test/ledger/apply.test.ts`, `test/cli/**`, `test/e2e/roundtrip.test.ts`.
- No shared file of the skeleton changes (module matrix, CLI entry and command table, `package.json`, port interfaces):
  the `acts` port keeps its interface.
- Held AREAs: `TR`, `AC`, `CT`, `LG`, `CL` — `LG` and `CL` by the maintainer's decision of 2026-10-02 (umbrella #44).

## Non-goals

- The store command `upgrade` and `std@1 → @2` (LG-G02, SL-T07 (3)): slice SW.
- Writers and owner-act checks in apply (CT-N03, TR-F06), the namespace existence part of CT-N02, in force (TR-I01):
  later slices; S0 apply records acts and computes basis but rejects nothing by them (TR-B03).
- Admission of bodies against their types, the exemptions of LG-A07 for the self-typed meta-type and the session type
  (OM-R03): #82.
- The status fact types `retired`, `alias`, `calibration`, `verdict`, `dismissed` and the adapter block of `setup`
  (PL-A05): their slices.
- Wiring the `github` adapter into a CLI command or CI (LG-P05): slice SW.
- The transition commit of a new kernel version (LG-G03, LT-01).
