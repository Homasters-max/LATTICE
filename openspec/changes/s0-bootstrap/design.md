# Design

## Context

Motivation — proposal.md, Why; behaviour — the delta specs `trust`, `acts`, `catalog`, `ledger` and `cli` of this
Change. Today (after `s0-skeleton` #54, `s0-kernel` #55, `s0-apply-checks` #56, `s0-store-2` #57):
- `src/kernel/` exports `metaType` (REQ-KR-016), `admit`, `formatAt` and the transitional `hash`, `newId` (REQ-KR-018);
  the session event type, "the other half of `core`", and writing both at genesis are left to this Change.
- `src/ledger/` — `parseProposal`, `proposalHash`, `apply(ledger, proposal)` with the rules `LG-C03`, `LG-C07`,
  `LG-P01`, `LG-P02`, `openLedger(stored)` (LG-C04) giving `Ledger = { tail, view, proposals }`, `KERNEL_VERSION = "0"`,
  `SESSION_TYPE = "core/session@1"`; the `acts` port `src/ledger/ports/acts.ts` (`Act = {login, names, ref}`,
  `actsOn(proposal)`) has no adapter and no caller.
- `src/trust/index.ts` is empty (`export {}`), left for this Change by the skeleton.
- `src/assembly/index.ts` — `init` writes `store/lattice.json`, an empty ledger and `store/proposals/`; `importMd`,
  `apply`, `exportTo` open the ledger with `openLedger`.
- REQ-CL-002 says the ledger starts empty: "genesis, `std` and the namespace commit (LG-G04) are not written by
  `init`".

## Goals / Non-Goals

**Goals:**
- `lattice init` writes genesis, `std`, the project namespace and `setup@1` with its `live` fact, each through apply
  (LG-G04, LG-A07), and every ID of the issue is bound to a passing `SCN-…` test (table "Coverage" below).
- The `acts` port gets its four adapters with one contract test (ST-T01); apply records the acts that confirm a
  commit's intents (LG-A05) and the basis of every record follows from its commit (TR-B02).
- No change to a file the skeleton owns (SL-T08): the module matrix, the CLI entry and command table, `package.json`,
  the port interfaces (`src/ledger/ports/acts.ts` keeps its interface).
- No shared source path with a parallel Change: #60 holds `src/ledger/projections/**`, #58 `src/codec/**` (D-12).

**Non-Goals:**
- Everything proposal.md, Non-goals, names: `upgrade` (SW), writers and owner-act checks (CT-N03, TR-F06), in force
  (TR-I01), the namespace-existence part of CT-N02, admission of bodies against their types and the type exemptions of
  LG-A07 (#82), the other status fact types, the adapter block of `setup` (PL-A05), wiring `github` into CI (SW), the
  transition commit (LT-01).
- Moving the callers to the new kernel interface (#83): the new code uses `formatAt` and the transitional `hash` and
  `newId` like its neighbours.

## Decisions

### D-1. AREAs `TR`, `AC`, `CT`, `LG`, `CL`

The issue declared `TR` + `AC` + `CT`. Its "Done when" needs `LG` — the commit form, apply with acts, the rule `CT-N02`
and its exemptions, genesis and `std`, the opening checks — and `CL` — REQ-CL-002 states the opposite of LG-G04, and
the `init` path of `assembly` and `cli` changes. The maintainer decided on 2026-10-02, before `warrant init change`,
that this Change holds all five (row `I-1`; issue #59 `Where:` edited before `init`; umbrella #44 comment
5950552798). `#82` (`LG`) already depended on #59; `#98` and `#83` (`CL`) wait for the archive of #59.

Rejected: splitting into a pure `TR` + `AC` + `CT` Change and an `s0-init` Change (`LG` + `CL`) — the pure half ships
builders and adapters with no caller, and the two would share `src/ledger/**`; leaving `init` to #98 — `s0-store-cli`
would then hold the bootstrap's acceptance criterion.

### D-2. Genesis lives in `ledger` (`src/ledger/genesis.ts`)

LG-G01 says genesis is "produced by kernel code": its hash is a constant of the kernel version (GL-14). The module
`kernel` (OM-L04) is the pure core of admission and hashing and holds the meta-type; the commit form, the proposal and
`KERNEL_VERSION` live in `ledger`. So `genesis.ts`, next to `KERNEL_VERSION`, holds:
- `SESSION_TYPE_BODY` — the body of `core/session` (REQ-LG-006), frozen;
- `GENESIS` — the genesis `Proposal` (`intents` and `session`), frozen, built from `metaType.body` and
  `SESSION_TYPE_BODY`;
- `GENESIS_PROPOSAL` — its proposal hash; `GENESIS_HASH` — the commit hash of commit 1, a literal. `genesis.ts` never
  calls `apply` (no cycle): a test applies `GENESIS` and compares the commit hash with `GENESIS_HASH` and with its own
  literal (SCN-LG-009), so a change of the genesis needs both edits.

The kernel stays untouched (no `KR`): the session type is data of kernel version `0` written by the ledger. It declares
every member of CT-P01 — `participant`, `kind`, `purpose`, `of` required; `software`, `version`, `established`
(CT-P03) and `pipeline` optional, because no session of S0 writes them yet (review 1, F-2). The genesis hash depends
on this body, so it is settled here once for kernel `0`.

Rejected: `sessionType` in `src/kernel/` next to `metaType` — it would hold `KR` and grow the kernel perimeter (ST-K01)
for a constant the kernel never reads.

### D-3. The `std` package (`std/std.json`, `src/ledger/std.ts`)

- `std/std.json` at the repository root (LG-S05): the canonical form of REQ-LG-007, written by hand once, read only as
  bytes. It is not under `src/`, so neither the structure test nor `tsconfig.json` sees it, and `package.json` is not
  touched.
- `std.ts` (pure): `STD_HASH` (a literal), `packageHash(entities)` (`hash("core/std", entities)`),
  `readStd(text): { ok: true; entities } | { ok: false; message }` — the text must parse (`checkInput`), be the
  canonical form plus one line feed, have entities of the form and `packageHash` equal to `STD_HASH`; the message names
  `LG-G02` —, and `stdProposal(entities, session)`.
- `assembly` reads the bytes from `new URL("../../std/std.json", import.meta.url)`; `Ports` gains `std?: string` (the
  package text, injected by SCN-CL-015) beside `store`, `clock`, `ids`. `Ports` is the assembly's own type, not a port
  interface file.

### D-4. The init proposals (`src/ledger/init.ts`)

`initProposals({ namespace, owner, at, ulids: [u1, u2, u3, u4], std: entities }): readonly Proposal[]` — pure, the four
proposals of REQ-LG-008 in order; ids through the transitional `newId` (`std` for `u1`, the namespace for `u2`…`u4`).
`setup@1` sets every port `fixture` with `memo` `false` (REQ-LG-008): `service` needs an adapter block (PL-A05) that
`std` does not have in S0.

### D-5. The rule `CT-N02` and the exemptions of LG-A07 (`rules.ts`, `apply.ts`)

- `REJECTION_RULES` gains `CT-N02`; `EXEMPTIONS = [{ rule: "CT-N02", by: "LG-G01" }, { rule: "CT-N02", by: "LG-G02" }]`
  as a frozen constant; `exempt(ledger, proposal, rule)` answers from the conditions of REQ-LG-002 — the genesis
  proposal hash on an empty ledger; the tail equal to `GENESIS_HASH` at `seq` 1, a `machine` / `init` session, no other
  event, and `packageHash` of the entity intents equal to `STD_HASH`. Nothing reads a key to decide an exemption.
- The check is one more pass of `rejectionsOf`: every intent whose namespace has `core` or `std` as its first
  `.`-separated part (`std/x`, `std.y/x`), unless exempt (review 1, F-11).
- Only the reserved part of CT-N02 is checked. "Only project namespaces are writable" would also reject an `id` whose
  namespace has no namespace entity; every ledger test of S0 applies `lattice/…` on an empty ledger, and the check
  belongs with the writers of the namespace (CT-N03), a later slice. Then the third exemption of LG-A07 — a namespace
  entity written into the namespace it creates — gets its check. The two type exemptions of LG-A07 (the self-typed
  meta-type, the session type in the first session's commit) lift OM-R03, which is #82.

### D-6. Acts in apply and the act record (`apply.ts`, `records.ts`, `commit.ts`)

- `apply(ledger, proposal, acts: readonly Act[] = [])` — `Act` from `ports/acts.ts`; existing callers and the tests
  of #58 and #60 keep compiling.
- `actRecord(acts, readHash, held)` builds the record of REQ-LG-003: keep an act that names `readHash` (the proposal as
  read), the held hash or a held `id`; `names` the check result (`[heldHash]` or the sorted held ids named); dedupe by
  canonical JSON; sort by it. The record is the check result of LG-A05, so re-applying the commit's own intents with
  `recordedActs` (whose names are `[proposal]` or ids) gives the same record.
- `Commit` gains `acts?: readonly Act[]`; `apply` sets it only when non-empty; `isCommitForm` accepts the optional key
  with its form. So every commit text written before this Change stays of the commit form — the rule fixtures, the
  reference ledgers of #60 and the store tests need no change.

### D-7. `trust` (`src/trust/{basis,facts,namespace,index}.ts`) and `ledger/basis.ts`

- `basis(session: unknown, acted: boolean): Basis` — the table of REQ-TR-001; `Basis = "asserted" | "derived" |
  "observed" | "inferred"`.
- `currentFacts(bodies)` and `liveRevision(events, id)` — REQ-TR-002; keys compared by `canonical`.
- `policyOf(body)` and `actLogins(policy)` — REQ-CT-001.
- `trust` imports only `kernel` (ST-M01). `ledger/basis.ts` gives `bases(commit): ReadonlyMap<Id, Basis>` from the
  session record and the act record (REQ-LG-009); `ledger` may import `trust`.

### D-8. Opening a store (`commit.ts`)

`openStore(stored, namespace)` = `openLedger` (unchanged, still used by the tests of every module) followed by the
checks of REQ-LG-010 over the commits it read: the genesis chain and the four init commits for the namespace of the
init configuration (`LG-G04`, row `I-4`). So a store opens only once store init finished, and `apply` never writes in
the place of an init commit; the namespace commit is checked against `store/lattice.json` (review 2, F-2, F-7). Two words, two checks (review 1, F-1): REQ-CL-004 **Opening** stays LG-C04 —
what the rule fixtures (REQ-AR-011, `test/architecture/rules.test.ts` with `openLedger`), L1 and the reference ledgers
of #60 pass —, and **Opening a store** is the genesis chain, run only on a project store. So no fixture outside this
Change's paths has to move onto the genesis chain. The `LG-G02` check of opening repeats the conditions of the
apply exemption (F-12). `apply` and `export` open with `openStore`; `import-md` reads no ledger (row `I-6`). `openLedger` keeps its signature; an internal reader shared by both keeps the
parsed commits. The checks need `GENESIS_HASH` and `packageHash`/`STD_HASH`, so `commit.ts` imports `genesis.ts` and
`std.ts`, which import only `kernel`, `proposal.ts` and `records.ts`. `assembly` opens with `openStore` in every
command; the refusal message is `<rule>: seq <n>: <why>`, like LG-C04's.

### D-9. Adapters of `acts` (`src/adapters/acts-{init,fixture,recorded,github}/index.ts`)

Each imports only `src/ledger/ports/acts.ts` (REQ-AR-009) and freezes what it answers:
- `initActs(owner)`, `fixtureActs(acts)` — REQ-AC-002, REQ-AC-003;
- `recordedActs(texts)` — `JSON.parse` of each stored commit text (an adapter may use built-ins); never a network
  call;
- `githubActs({ repo, pr, logins, transport })` — REQ-AC-005; `transport: (path: string) => unknown`. S0 ships no
  default transport: nothing calls GitHub until SW wires the adapter into CI with a `gh api` transport (SL-T07 (4)).
  An adapter may import only its port, so it holds its own regular expression for the identifiers of REQ-KR-012; its
  test checks every token it finds against the kernel `parseRef`.

### D-10. `init` in `assembly` and `cli`

`lattice(root, ports).init(namespace, owner)`: check the options; read and check the package (`readStd`); take one
`at` = `formatAt(clock.now())` and four ULIDs in order; build `initProposals`; then, **in memory** (review 1, F-8), for
each proposal open the texts built so far (`openLedger` over a `StoredLedger` of them — `openStore` would refuse a
partial init), `apply` it with `[]` (genesis) or `initActs(owner).actsOn(proposalHash(p))`, and keep the commit text —
any other outcome refuses with code 2 naming the commit. Every refusal so far writes nothing. Only then create `store/`
with `mkdirSync` without `recursive` (it fails when `store/` appeared since the check, review 2 F-5), `store/lattice.json`, `store/proposals/`,
an empty `store/knowledge.jsonl`, and append the four texts through the `store` port, each after the `seq` before it;
a `moved` answer refuses with code 2 naming the store (SCN-CL-017). Print the four lines `{"outcome":"commit","seq":n}`.
`commands/init.ts` keeps its options and prints the lines. The `apply` command passes no acts (REQ-CL-004).

### D-11. Tests

| Test | Covers |
|---|---|
| `test/trust/basis.test.ts`, `test/trust/facts.test.ts`, `test/trust/namespace.test.ts` | SCN-TR-001, SCN-TR-002, SCN-CT-001 |
| `test/acts/contract.test.ts` (one case, four adapters) | SCN-AC-001 |
| `test/acts/adapters.test.ts` | SCN-AC-002, SCN-AC-003, SCN-AC-004, SCN-AC-005 (recorded GitHub JSON in `test/fixtures/acts/github/`) |
| `test/ledger/genesis.test.ts` | SCN-LG-009, SCN-LG-010, SCN-LG-014 |
| `test/ledger/init.test.ts` | SCN-LG-011, SCN-LG-013, SCN-CT-002 |
| `test/ledger/apply.test.ts`, `test/ledger/permutation.test.ts`, `test/ledger/cases.ts` | SCN-LG-002…004, SCN-LG-006, SCN-LG-007, SCN-LG-008, SCN-LG-012 (L1 is the ledger of `cases.ts`) |
| `test/fixtures/rules/CT-N02/` | the fixture of the new rule (REQ-AR-011, run by SCN-AR-017 unchanged) |
| `test/cli/*.test.ts`, `test/cli/project.ts`, `test/e2e/roundtrip.test.ts` | SCN-CL-001…016 on a store that holds the init commits |

### D-12. Source and test paths (the `--scope` of the implement Run)

`src/trust/**`, `src/adapters/acts-init/**`, `src/adapters/acts-fixture/**`, `src/adapters/acts-recorded/**`,
`src/adapters/acts-github/**`, `src/ledger/apply.ts`, `src/ledger/commit.ts`, `src/ledger/rules.ts`,
`src/ledger/records.ts`, `src/ledger/proposal.ts`, `src/ledger/index.ts`, `src/ledger/genesis.ts`, `src/ledger/std.ts`,
`src/ledger/init.ts`, `src/ledger/basis.ts`, `src/assembly/index.ts`, `src/cli/commands/init.ts`, `std/**`,
`test/trust/**`, `test/acts/**`, `test/ledger/**`, `test/cli/**`, `test/e2e/**`, `test/fixtures/rules/CT-N02/**`,
`test/fixtures/acts/**`, `openspec/changes/s0-bootstrap/**`.

Conditionally: `test/fixtures/projections/*/ledger.jsonl` and their `index.json` — by the maintainer's decision
(row `I-2`), the one of #59 and #60 whose impl-PR merges last regenerates them with `test/projections/reference.ts`
and shows the `index.json` diff in its PR. Commits without acts keep their form (D-6), so #59 expects no diff; if #60
merges first, the impl-PR of #59 still runs the generator and adds these paths to its `--scope` only when it changes
a byte.

Not in it: `src/ledger/projections/**`, `test/projections/**` (#60), `src/codec/**`, `test/codec/**` (#58),
`src/ledger/ports/**`, `src/cli/table.ts`, `src/cli/main.ts`, `test/architecture/**`, `package.json` (skeleton). The
callers of `apply` and `openLedger` in `src/codec/**` and `test/codec/**` (#58) need no edit: `apply` gains only an
optional third argument and `openLedger` keeps its signature and behaviour (D-6, D-8).

### D-13. Known gaps of the `std` schemas

The kernel subset (REQ-KR-015) cannot say "exactly one of `login` and `kind`" or "exactly one of `value` and
`revoked`", so `std/namespace` and `std/live` admit bodies that `policyOf` and `currentFacts` reject (review 1, F-17).
The pure functions of `trust` are the check in S0; admitting bodies under their types is #82.

### Coverage

| ID | Bound to | Rest |
|---|---|---|
| LG-G01 | SCN-LG-009, SCN-LG-014, SCN-CL-016 | — |
| LG-G02 | SCN-LG-010, SCN-LG-008, SCN-LG-014, SCN-CL-015 | `upgrade` and `std@1 → @2`: slice SW (SL-T07 (3)) |
| LG-G03 | SCN-LG-014 (no kernel but `0`) | the transition commit: LT-01 |
| LG-G04 | SCN-LG-011, SCN-LG-014, SCN-CL-002, SCN-CL-016, SCN-CL-017 | — |
| LG-A07 | SCN-LG-008, SCN-LG-007, SCN-LG-011 | the type exemptions with OM-R03 (#82); the namespace exemption with CT-N03 |
| CT-N01 | SCN-CT-001, SCN-CT-002 | — |
| CT-N02 | SCN-LG-008, SCN-CL-002 | namespace existence with CT-N03 (later slice) |
| CT-N05 | SCN-CT-002, SCN-LG-011 | — |
| TR-B02 | SCN-TR-001, SCN-LG-013 | row 2 reads pipeline stages when the pipeline type exists (S1) |
| TR-F05 | SCN-TR-002, SCN-LG-011 | the other status fact types: their slices |
| PL-A01 | SCN-LG-010, SCN-LG-011 | the adapter block of `service` (PL-A05): S1 |
| LG-A04 | SCN-AC-001…005 | — |
| LG-A05 | SCN-AC-004, SCN-LG-012, SCN-LG-013 | — |
| CT-A03 | SCN-AC-005 | wiring into CI (LG-P05): SW |
| CT-A05 | SCN-AC-005, SCN-CT-001 | the writers check in apply: CT-N03 |

## Decisions on implementation (I-N)

| Row | Decision | Reason | By |
|---|---|---|---|
| I-1 | #59 holds `TR` + `AC` + `CT` + `LG` + `CL` (D-1). | "Done when" needs the commit form, apply and opening (`LG`) and `init` (`CL`, REQ-CL-002). | the maintainer, 2026-10-02 (session of #59, before `init`; issue #59 edited; umbrella #44 comment 5950552798) |
| I-2 | `src/ledger/commit.ts` and `src/ledger/index.ts` belong to #59 alone; #60 keeps `src/ledger/projections/**`, `test/projections/**`, `test/fixtures/projections/**`; #59's impl does not wait for #60's; whichever impl-PR merges last regenerates the reference ledgers of #60 (D-12). | The two sessions settled the overlap (umbrella #44 comment 5950598775); #59 keeps `view: latest(commits)` in `openLedger`. | the maintainer, 2026-10-02 (umbrella #44 comment 5950938286, superseding items 1–3 of 5950571583) |
| I-3 | Spec review 1 (`EVID-01M3Y4GWN1C7DRB0V0DN1M6WAF`, NOT_PROVEN): F-1 Opening split from Opening a store (D-8); F-2 every CT-P01 member in the session type (D-2); F-3 the table is read only for a valid session; F-4 the fact body and the revision value; F-5 tokens; F-6 no transport in S0; F-7 stems `namespace` and `setup` refused; F-8 init builds in memory first (D-10), `moved` during init; F-9 non-empty act strings; F-10 failed reads and paging; F-11 dotted reserved namespaces; F-12 opening repeats the exemption; F-13 who reads `recordedActs`; F-14 the order of `policyOf`; F-15, F-16 wording; F-17 D-13; F-18 exact logins and the synchronous transport stated in REQ-AC-005. | The findings of review 1, all taken. | this spec-PR |
| I-4 | A project store opens only when it holds the four init commits for the namespace of its init configuration; otherwise it is refused with code 2 naming `LG-G04` and the `seq` (REQ-LG-010, REQ-CL-004, D-8). An empty ledger of an older `init` is refused too. | Spec review 2 (`EVID-01M3YBKXXTSPV90T9HFE0Z8GGW`), F-2 (MAJOR): a prefix of the chain opened, and `apply` wrote a user commit in the place of an init commit, breaking the store for good; option 1 of its decision D-1. Closes F-7 too. | the maintainer, 2026-10-02 (session of #59) |
| I-5 | Review 2: F-1 `currentFacts` in SCN-TR-002 gets only the `std/live@1` bodies; F-3 an adapter answers or throws (REQ-AC-001); F-4 `recordedActs` filters as `fixtureActs` does; F-5 `init` creates `store/` exclusively; F-6 the test list of `proposal.md`; `init` builds in memory with `openLedger` (D-10). | The findings of review 2, all taken. | this spec-PR |
| I-6 | Opening a store is run by `apply` and `export`; `import-md` reads no ledger (REQ-LG-010, D-8). | Spec review 3 (`EVID-01M3YC7FK7A7RTJZB4NH4N6WHC`), F-1. | approval of spec-PR #120 (planned there as I-6) |
| I-7 | `LG-G03` is checked on every commit; a commit failing two checks names the first rule in the list order of REQ-LG-010. | Review 3, F-2. | approval of spec-PR #120 |
| I-8 | The init commits are found by position; the `seq` named is that commit's, and for a short ledger the `seq` of its last commit plus one (REQ-LG-010). | Review 3, F-3: `seq` may have gaps. | approval of spec-PR #120 |
| I-9 | REQ-CL-002: the commit lines are printed only after all four appends. | Review 3, F-4. | approval of spec-PR #120 |
| I-10 | SCN-CL-017 names the proposal file `lattice apply` runs on: one a fresh `import-md` wrote. | Review 3, F-5. | approval of spec-PR #120 |
| I-11 | The `LG-G04` message of a short ledger and REQ-CL-002 say how to recover: remove `store/` and run `lattice init` again. | Review 3, F-6. | approval of spec-PR #120 |
| I-12 | REQ-CL-001: the JSONL store locks, `fsync`s and recovers each append (REQ-SR-001…003); a command's own files and the four appends of `init` are not one transaction. | Review 3, F-7. | approval of spec-PR #120 |
| I-13 | Known gap, stated in REQ-LG-010: opening checks commits 3–4 by `id`, `rev`, `type`, not their bodies, sessions, acts or owner; the `owner` of `store/lattice.json` is the namespace owner at init only. | Review 3, F-8 (INFO). | approval of spec-PR #120 |
| I-14 | `std/std.json` is copied into the branch by the maintainer from a file this Change generated (its hash is pinned by `STD_HASH` and SCN-LG-010); the agent commits it. | The `write_scope` of the `implement` Run is `src/**`, `test/**` and the Change's artifacts; `std/` (LG-S05) is outside it. Spec unchanged. | the maintainer, 2026-10-02 (session of #59) |
| I-15 | Implementation review (`code-review`, Standards S-1…S-10, Spec P-1…P-9). Fixed: one `isAct` in `ledger/records.ts` for the commit form and the act record, which now drops an act with an extra key (S-1, P-6); `currentFacts` returns a Map whose `set`, `delete`, `clear` refuse, `bases` a frozen object, `policyOf` frozen copies (S-3, P-1); the shape of the init commits and the `std` load check moved from `commit.ts` to `init.ts` next to the builder, `isInitSession` shared by apply and opening, `LIVE_TYPE` reused (S-4, S-5); apply decides exemptions from the `EXEMPTIONS` table (S-6); `namesIn` and `INIT_REF` no longer exported, `INIT_SESSION_BODY` not exported by the module (S-7, P-7); one clock read in `init` (S-9); the header of `commands/init.ts` (P-8); tests: all acts of SCN-LG-012 permuted, the answer after a failed transport, the fixture in SCN-CL-017, `rev` of `lattice/setup` (P-2…P-5). Kept: the act-form copies in the adapters `acts-fixture` and `acts-recorded` (an adapter imports only its port), the inline comparators of `trust` (the kernel exports none), `Ports.std` (D-3) — issue #131 with S-10; the `id as Id` of constant ids (S-8); `initProposals` answers a refusal value, not a bare list (P-7, D-4); no test races `store/` creation (P-9: no scenario asks; `mkdirSync` without `recursive`). Spec unchanged. | `code-review` of this impl-PR. | implementation, this impl-PR |

## Risks / Trade-offs

- [`GENESIS_HASH`, `STD_HASH` and every commit hash use the transitional `hash` (REQ-KR-018)] → #83 moves the record
  and commit hashes to OM-H01 and updates both literals; stores are disposable before the switch (LG-G05).
- [`CL` is held until the archive of #59] → #98 and #83 wait (D-1, umbrella #44).
- [Apply records acts but checks no writer] → S0 has two act sources, `init` (the owner) and `fixture` (tests); the
  `github` adapter filters by the logins it is given (`actLogins`). Apply checking writers comes with CT-N03.
- [The `github` adapter has no transport to GitHub in S0] → its contract runs on recorded JSON; SW adds the transport
  and the CI job with the maintainer's policy-path patch.
- [CLI scenarios shift by four commits] → `test/cli/project.ts` `initialised()` already runs `lattice init`; the
  tests read `seq` and hashes from the store instead of literals where they can.

## Migration Plan

None: stores are disposable before the switch (LG-G05). A store made by an older `lattice init` (an empty ledger) is
refused naming `LG-G04`, and one with commits from before this Change naming `LG-G01` (REQ-LG-010); either is rebuilt
with `lattice init` in a new folder and its `md` imported again (LG-B01).
