# Design

## Context

Motivation — proposal.md, Why; behaviour — `specs/architecture/spec.md` and `specs/cli/spec.md` of this Change. Today:
- `src/` holds only `kernel/` (format v1 of design v0.6): `checkInput` (I-JSON admission), `canonical` (JCS), `hash`
  and `valueId` (`sha256(JCS({body, type}))` with `type` an unpinned `namespace/local`), `parseRef` / `formatRef`,
  `newId(namespace, ulid)`, `refsOf` (references `{"$ref": "…"}` in a body), `revision` (an old record shape with
  `version`). The kernel never reads the clock or makes ULIDs; it is pure and checked by the structure test.
- `test/architecture/structure.ts` checks a tree against a `Policy` (`sources`, `entry`, `perimeter`): the purity rules
  of REQ-AR-001 for perimeter files, reachability (REQ-AR-003), cycles (REQ-AR-004), tests inside `describe`
  (REQ-AR-002). Each file is parsed once into facts (imports with lines, AST); rules are functions over the parsed tree.
- Stack: TypeScript on Node.js 22 (`--experimental-strip-types`, no build step), `node:test`, `typescript` as the
  only devDependency. CI (`test.yml`) runs `npm run typecheck` and `npm test` on every PR.
- `package.json` is in the profile `human-acceptance` and outside the `write_scope` of an `implement` Run: a change of it
  is a maintainer's patch (as in Change `kernel-format`, design D-6).
- Before the switch the store is disposable and the kernel version is `0` (LG-G05): the ledger format of the skeleton
  may change in the Changes of wave 2 without migration.

## Goals / Non-Goals

**Goals:**
- One path through every seam, each seam in the module ST-M01 gives it, so that wave 2 grows a seam inside its module
  without touching another Change's paths.
- The shared files of SL-T08 exist and are final enough that wave 2 does not need to change them: the module matrix in
  the policy, the CLI entry and table, the port interfaces, `package.json`.
- Every design ID the requirements implement is bound to a scenario (`Implements:` lines, SL-T03, SL-T06).

**Non-Goals:**
- Everything proposal.md, Non-goals, assigns to wave 2.
- A general `md` parser: the codec accepts only the form it writes (D-6).
- Performance: the fixture is a few rows; the projection is rebuilt in memory on every command (LG-J04 allows it).

## Decisions

### D-1. Source layout

| Module | Files of the skeleton |
|---|---|
| `kernel` | unchanged |
| `trust` | `src/trust/index.ts` — the module entry, empty (`export {}`) with a comment: it grows in s0-bootstrap (#59) |
| `ledger` | `index.ts` (public entry), `proposal.ts` (intents, parse, canonical order, proposal hash), `apply.ts`, `rules.ts` (`REJECTION_RULES`, `Rejection`), `commit.ts` (commit form, commit hash, `openLedger` with the chain check), `projections/latest.ts`, `ports/store.ts`, `ports/acts.ts` |
| `codec` | `index.ts`, `table.ts` (the skeleton form: parse, render) , `import.ts`, `export.ts` |
| `runtime` | `ports/clock.ts`, `ports/ids.ts` only (D-2) |
| `adapters` | `store-jsonl/index.ts`, `clock-system/index.ts`, `clock-fixed/index.ts`, `ids-ulid/index.ts`, `ids-counter/index.ts` |
| `assembly` | `index.ts` — the composition root: `lattice(root, ports?)` returning the four operations (D-7) |
| `cli` | `main.ts` (entry, shebang), `run.ts` (`run(argv, io)`), `table.ts` (the command table), `commands/{init,import-md,apply,export}.ts` |

A module is imported through its files directly (`../ledger/index.ts` from `codec`); a public entry per module is a
convention of the skeleton, not a rule of the structure test (D-3).

Rejected: one file per module — the files of wave 2 (#56, #57, #58, #60) would all be the same file and collide.

### D-2. Ports and where their interfaces live

| Port | File | Interface |
|---|---|---|
| `store` | `src/ledger/ports/store.ts` | `type StoredCommit = { seq: number; text: string }`; `interface Store { read(): readonly StoredCommit[]; append(commit: StoredCommit, after: number): { ok: true } \| { ok: false; reason: "moved" } }` — `after` is the `seq` the commit is written after (`0` on an empty ledger, LG-C03); `text` is the canonical JSON of the commit, without the line feed |
| `acts` | `src/ledger/ports/acts.ts` | `type Act = { login: string; names: readonly string[]; ref: string }`; `interface Acts { actsOn(proposal: string): readonly Act[] }` — the acts naming a proposal hash or its intent ids (CT-A05, LG-A04); no adapter and no caller in the skeleton |
| `clock` | `src/runtime/ports/clock.ts` | `interface Clock { now(): number }` — integer UTC milliseconds (PL-K01) |
| `ids` | `src/runtime/ports/ids.ts` | `interface Ids { ulid(): string }` — a new ULID (OM-I02) |

ST-M01 puts the `store` and `acts` interfaces in `ledger` and the port interfaces of 06 (`clock`, `ids` are recorded
ports, PL-K01) in `runtime`. Q7 of the launch grilling lists `runtime` among the modules of S1, but ST-M02 names `clock`
and `ids` among the ports of S0. So `src/runtime/` is created now holding only `ports/`; S1 adds the rest of the
module. Port files hold types only, so they import nothing.

Rejected: `clock` and `ids` in `ledger/ports/` — S1 would move them to `runtime`, a change of skeleton-owned files and of
every adapter; in `assembly` — the adapters would import `assembly`, which imports them back (a cycle and a matrix
violation); a new module `ports` — a module outside ST-M01 is a design change (ST-M01, ST-M02).

### D-3. Structure test: modules and ports as policy data

`Policy` gains an optional `modules` field:

```ts
type Module = { name: string; files: string; imports: readonly string[]; builtins: boolean; packages: boolean };
type Policy = { sources; entry; perimeter; modules?: { list: readonly Module[]; ports: Record<string, string> } };
```

`imports` names modules, or `runtime:ports` for the port interface files of `runtime` (the `capabilities` row).
Adapters are not listed one by one: a file `src/adapters/<port>-<name>/…` with `<port>` in `ports` is a module named
`adapters/<port>-<name>` that may import only `ports[<port>]`, with `builtins` and `packages`; `assembly` lists
`adapters` and so may import every adapter. `test/architecture/policy.ts` holds the table of REQ-AR-009 as this data.

The new rules are functions over the parsed tree, next to `purity`, `perimeter` and `cycles`; they skip perimeter
files, files with `parse-error` and files outside `src/` (REQ-AR-009):
- `moduleOf(path)` — the module of a path or `null`; an adapter folder must match `<port>-<name>` with `<port>` a key
  of `ports` (`[a-z]+`) and `<name>` `[a-z0-9][a-z0-9-]*`;
- `matrix` — `outside-matrix` (line 0) for every `src/` source file with no module; `non-ts-file` (line 1) for a
  source file of a module not named `*.ts` (the loader already lists such files, it parses only `*.ts`);
  `import-direction` for every edge (the same edges as REQ-AR-007) from a file of module A to a path not in A and not
  in a module A may import — another module, `null` under `src/`, or outside `src/`; `package-import` for every
  non-relative specifier against `builtins` / `packages` (`node:` prefix → built-in; anything else → package);
- purity of pure modules (REQ-AR-010) reuses the `purity` function of the kernel with its import rules switched off:
  `forbidden-global`, `nondeterminism`, `dynamic-import` only. A pure module is one with `builtins: false` and
  `packages: false`, except `kernel` (checked by REQ-AR-005).

The fixture trees of SCN-AR-015 and SCN-AR-016 carry a clean `src/kernel/index.ts`, so `no-kernel` does not stop the
check. Facts already parsed per file (imports with their specifier and line) are enough; no second walk or parse.
Without `modules` none of the new rules runs, so every existing fixture keeps its result under SCN-AR-009…014.

The finer limits of ST-M01 on what `codec`, `runtime` and `capabilities` read of `ledger` (proposal format, read view)
are not encoded: `ledger` has no stable file boundary for them yet, and `runtime` and `capabilities` hold no code in S0.
Row `I-3`, issue #76.

Rejected: a regex over import lines — the existing parse already gives every form of REQ-AR-007 (type positions,
`require`, re-exports); a third-party dependency-cruiser — a new dependency for what the graph already holds.

### D-4. Proposal, intents and canonical order (`ledger/proposal.ts`)

```ts
type EntityIntent = { kind: "entity"; id: Id; type: string; base: number; by: Id; body: unknown };
type EventIntent  = { kind: "event";  id: Id; type: string; by: Id; at: string; body: unknown };
type Proposal = { intents: readonly (EntityIntent | EventIntent)[] };
```

- A proposal file written by `import-md` is the canonical JSON of `Proposal` with intents in canonical order and one
  line feed. `parseProposal(text)` admits the text with the kernel `checkInput` (I-JSON, NFC) and checks the form of
  REQ-CL-004 in the order of its table: the text and the top level, then every intent, then (only if all passed) the
  session count, then (only with one session) every `by`; each deviation is a rejection `LG-P01` with the fields the
  table gives.
- Field checks reuse the kernel: `id` and `by` through `parseRef` without a version and a `namespace/local` id (not a
  value id), `type` through `parseRef` with a version (a pinned `type@n`, OM-E02), `base` a safe integer ≥ 0, `at`
  matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`.
- Duplicates (LG-C07, the part the skeleton needs): a second intent naming an `id` already named earlier in the list
  is a rejection `LG-C07` at its `/intents/<i>/id`. The permutation test and fact keys stay with s0-apply-checks (#56).
- Canonical order (LG-C07): entity intents by `id`, then event intents by `id`, by UTF-16 code units. Fact keys come with
  the first fact type (s0-bootstrap).
- Proposal hash: kernel `hash("core/proposal", intents in canonical order)`.

### D-5. Apply, commit and projection (`ledger`)

- `apply(ledger: Ledger, proposal: Proposal): { outcome: "commit"; commit: Commit; text: string } | { outcome:
  "rejected"; rejections: readonly Rejection[] }` — pure (ST-S03). It never assigns an `id`, `by` or `at` (LG-P01).
- `rules.ts`: `const REJECTION_RULES = ["LG-C07", "LG-P01", "LG-P02"] as const`; `type RuleId = typeof REJECTION_RULES[number]`;
  the only constructor `reject(rule: RuleId, …)`, so a rejection with a rule outside the list does not type-check
  (REQ-AR-011). Rejections are sorted as REQ-CL-004 says.
- `openLedger(stored: readonly StoredCommit[]): { ok: true; ledger: Ledger } | { ok: false; seq: number; message:
  string }` — admits each text with `checkInput`, requires `canonical(parsed) === text`, `seq` ≥ 1 and growing, `prev` equal
  to the hash of the commit before (`null` first): LG-C04. `Ledger` holds the commits, the tail (`seq`, hash) and the
  `latest` projection.
- Commit hash: kernel `hash("core/commit", commit)` — `sha256(JCS({body: commit, type: "core/commit"}))`.
- Entity record hash: kernel `hash(<type without @n>, body)`. This is not yet OM-H01 (which covers `type@n`): the
  existing kernel `hash` refuses a pinned type, and the issue keeps the kernel as it is; s0-kernel (#55) binds OM-H01,
  and the disposable store (LG-G05) needs no migration. Row `I-1`.
- `projections/latest.ts`: `latest(commits): ReadonlyMap<Id, EntityRecord>` — a fold in ledger order, the last record of
  each entity `id` wins; records frozen (`Object.freeze`, SL-T02). `ReadView` = `{ get(id): EntityRecord | undefined;
  entities(): readonly EntityRecord[] }` (sorted by `id`) — the only way `codec` and `apply` read entities (LG-J03,
  PL-K05).
- The `at` of a session event is formatted by `assembly` from `clock.now()` with `new Date(ms).toISOString()`. OM-E03
  wants only the kernel to format `at`; the kernel exports no formatter yet, so this one call moves into the kernel with
  s0-kernel (#55). Row `I-2`.

### D-6. Codec: the skeleton form only (`codec`)

- `parseTable(text): Result<Table>` and `renderTable(table): string` in `table.ts`. A line is accepted only when
  `renderLine(cells)` gives it back exactly; so everything import accepts, export writes back byte for byte, and the
  round trip holds by construction for every accepted file (LG-B04 asks the corpus to be normalized to the codec form).
- `importMd(bytes, fileName, { namespace, session: { id, at } }): Result<Proposal>` — pure; it runs the steps of
  REQ-CL-003 in order and refuses with the line of the first deviation: the file name, strict UTF-8 decoding
  (`TextDecoder` with `fatal: true`, no BOM), the table form, the header and IDs (a row ID equal to the stem gives
  the line of that row), and every cell through the kernel `checkInput` of its JSON string (NFC, assigned code points). Row type: `<namespace>/
  table.<slug>@1`, `slug` = the header cells after `ID`, each lower-cased with every run of characters outside
  `[a-z0-9]` replaced by `-` and trimmed of `-`, joined by `.` (`| ID | Rule |` → `lattice/table.rule@1`). Row body:
  `{ "<header cell>": "<cell>" , … }`. Document: `id` `<namespace>/<file stem>`, type `<namespace>/document@1`, body
  `{ "file": "<file name>", "columns": [ … ], "rows": [ { "$ref": "<row id>" }, … ] }` — a floating reference, as the
  kernel `refsOf` reads it. Session event: type `core/session@1`, body `{ "of": {}, "participant": "lattice",
  "kind": "machine", "purpose": "import" }` (OM-E04, CT-P01, TR-B02).
- `exportMd(view: ReadView, namespace): Result<readonly { file: string; text: string }[]>` — every entity whose type
  is `<namespace>/document@1`, rows resolved through `view.get` (floating → latest, OM-R01), the ID cell as the local
  part of the row `id` in upper case; every refusal of REQ-CL-005 is found before the result is returned, so assembly
  writes either every file or none.
- The types named here are names only: no type entity exists before s0-bootstrap, and the skeleton's apply does not
  check that a type exists (OM-R03 is #56).

Rejected: parsing GitHub-flavoured tables in general (alignment rows, escaped pipes, padding) — every accepted variant
needs its own export form or the round trip breaks; that is the normalization work of #53 and #58.

### D-7. Assembly: the composition root

`lattice(root: string, ports?: Partial<{ store: Store; clock: Clock; ids: Ids }>)` returns `init`, `importMd`, `apply`,
`export`, each returning a typed outcome (never an exit code, never printing): `{ kind: "done", … } | { kind:
"rejected", … } | { kind: "refused", message }`. Default ports: `store-jsonl` on `<root>/store/knowledge.jsonl`,
`clock-system`, `ids-ulid`. It reads and writes `store/lattice.json` and `store/proposals/*` with `node:fs` (ST-S03:
`assembly` reads configuration; proposals are files of the git workflow, not the ledger, so they are not behind
`store`). It validates the init options and the configuration (REQ-CL-002) and builds the session `id` through kernel `newId`.
`apply` takes only a file directly in `<root>/store/proposals/` (REQ-CL-004); `importMd` refuses an existing proposal
file of the same name; a `moved` answer of the store is a refusal naming LG-C03; an error of `node:fs` while writing is
a refusal naming the file (no atomicity before s0-store, REQ-CL-001).

### D-8. CLI: entry, table, commands

- `src/cli/main.ts`: shebang `#!/usr/bin/env -S node --experimental-strip-types`, calls `run(process.argv.slice(2),
  { cwd: process.cwd(), out, err })` and sets `process.exitCode`.
- `run(argv, io & { ports? })` looks the command up in `table.ts` — `{ name, summary, run }` per command, one file per
  command in `commands/` (PL-E02) — prints usage on a miss (REQ-CL-001), maps the outcome of `assembly` to the exit
  code `0 / 1 / 2` and to the output of REQ-CL-001…005. Options are parsed by `node:util` `parseArgs` (strict).
- `package.json` (maintainer's patch, D-10): `"bin": { "lattice": "src/cli/main.ts" }`.

### D-9. Adapters

- `store-jsonl`: `read()` reads the file, splits on `\n` (the last line must end with one), `JSON.parse` of each line
  only for `seq`; `append` re-reads the last `seq`, returns `moved` when it is not `after`, otherwise appends `text +
  "\n"` with `appendFileSync`. No lock, fencing, `fsync` or recovery: s0-store (#57) adds them with the memory adapter
  and the contract tests (ST-T01).
- `clock-system` (`Date.now()`), `clock-fixed` (a constant given at construction), `ids-ulid` (48-bit time from
  `Date.now()`, 80 random bits from `node:crypto` `randomBytes`, Crockford Base32), `ids-counter` (`0…0N` as a valid
  ULID, N counting from 1) — the deterministic pair of ST-T02 used by the tests.

### D-10. Tests, fixtures and the scope of the implement Run

| Path | Proves |
|---|---|
| `test/architecture/structure.test.ts` (changed), `policy.ts` (modules, ports) | SCN-AR-008…016 (the old tests renamed from SCN-AR-001…007) |
| `test/fixtures/structure/matrix/**`, `test/fixtures/structure/purity/**` | trees of SCN-AR-015, SCN-AR-016, marked `// expect: <rule>` like the kernel fixtures |
| `test/architecture/rules.test.ts`, `test/fixtures/rules/{LG-C07,LG-P01,LG-P02}/{ledger.jsonl,proposal.json,expected.json}` | SCN-AR-017 |
| `test/ledger/*.test.ts`, `test/codec/*.test.ts` | units under the tokens of the CL scenarios they serve |
| `test/cli/*.test.ts` — `run(argv, io)` in process, temporary folders, `clock-fixed`, `ids-counter` | SCN-CL-001…009 |
| `test/e2e/roundtrip.test.ts` — the entry as a child process (`process.execPath --experimental-strip-types src/cli/main.ts`) | SCN-CL-010 |
| `test/fixtures/md/fixture.md` (three rows `FX-A01…A03`, header `ID`, `Rule`), `test/fixtures/md/refused/*.md` | SCN-CL-003, SCN-CL-004, SCN-CL-010 |

The `ledger.jsonl` of a rule fixture is written once by the skeleton's own apply and kept frozen.

`implement` Run scope: `src/trust/**,src/ledger/**,src/codec/**,src/runtime/**,src/adapters/**,src/assembly/**,
src/cli/**,test/architecture/**,test/ledger/**,test/codec/**,test/cli/**,test/e2e/**,test/fixtures/md/**,
test/fixtures/rules/**,test/fixtures/structure/matrix/**,test/fixtures/structure/purity/**,
openspec/changes/s0-skeleton/**`. `src/kernel/**` and `test/kernel/**` stay out of it.

`package.json` is outside `write_scope`: the impl-PR carries a patch file and asks the maintainer («❗ Выполнить») to
apply and commit it into the branch before `VERIFYING`.

## Decisions on implementation (I-N)

| ID | Decision | Why | By |
|---|---|---|---|
| I-1 | The entity record hash is the existing kernel `hash(<type without @n>, body)`, not OM-H01 over `type@n`. | The issue keeps the kernel as it is; s0-kernel (#55) binds OM-H01; the store is disposable (LG-G05). | design |
| I-2 | `assembly` formats the `at` of a session with `new Date(ms).toISOString()`. | OM-E03 puts the formatter in the kernel, which has no exported one; it moves with s0-kernel (#55). | design |
| I-3 | The structure test checks ST-M01 at the granularity of modules; the limits on what `codec`, `runtime` and `capabilities` read of `ledger` are deferred to #76 (P2, milestone S1). | Spec review of this Change, F-13: no stable file boundary in `ledger` yet; `runtime` and `capabilities` hold no code in S0. | design |

## Risks / Trade-offs

- [The ledger format changes in wave 2 (envelope, hash, genesis)] → the store is disposable before the switch (LG-G05);
  the rule fixtures' `ledger.jsonl` are regenerated by the Change that changes the format.
- [`runtime` exists in S0 with only port interfaces] → it is the ST-M01 home of those ports; S1 grows it. The decision
  is posted on umbrella #44 as a slice-level decision.
- [`trust` is an empty module] → SL-T09 asks the skeleton to create every module folder; s0-bootstrap fills it. It
  exports nothing, so nothing depends on it yet.
- [A shebang with `env -S` and a `.ts` bin may not run through the npm shim on Windows] → the manual acceptance and CI
  use `node --experimental-strip-types src/cli/main.ts`; the `bin` is checked on Linux in CI by the e2e test only
  through `node`.
- [Three rejection rules only] → enough for the seam (SL-T09); s0-apply-checks (#56) adds rule IDs to
  `REJECTION_RULES`, and REQ-AR-011 forces a fixture for each.
- [No atomicity of a write before s0-store] → stated in REQ-CL-001; the store is disposable (LG-G05).

## Migration Plan

None: no store exists yet. The spec `architecture` is replaced at archive by this Change's delta (REMOVED REQ-AR-001…004, ADDED
REQ-AR-005…011); the spec `cli` is created.
