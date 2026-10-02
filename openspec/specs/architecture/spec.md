# architecture Specification

## Purpose
Правила структуры кода LATTICE, которые проверяет тест, а не ревью: направление импортов между частями системы,
границы ввода-вывода и форма тестов проекта (design/04-architecture.md §2, §3).

## Requirements

### Requirement: The kernel is isolated
<!-- id: REQ-AR-005 -->

The structure test SHALL check a file tree — the project or a fixture directory — against a policy: data naming the
list of sources, the kernel entry, the list of the kernel perimeter and, optionally, the modules of REQ-AR-009. The
entry is a path; the lists are lists of globs.

A path is a string relative to the root of the checked tree with `/` as separator, after resolving `.` and `..`
segments; paths are compared character by character, case-sensitively. A path outside the root (one that starts with
`..` after resolution) matches no glob: it is outside every list. A file of the tree is a path produced by a recursive
walk of the root; symbolic links are not followed; a file exists at a path only when the walk produced exactly that
path. In a glob the segment `**` is any number of path segments, zero included, `*` is any part of one segment, every
other character is literal. A path matches a list when it matches at least one of its globs.

A perimeter file is a file of the tree whose path matches the perimeter list; a source file is one matching the list
of sources. Sources are the nodes of the cycle rule (REQ-AR-008) and the files of the module rules (REQ-AR-009,
REQ-AR-010); the perimeter rule (REQ-AR-007) follows the edges of perimeter files regardless of the list of sources.
The test parses perimeter and source files named `*.ts`. The project policy is: sources `src/**`, entry
`src/kernel/index.ts`, perimeter `src/kernel/**`, and the modules and ports of REQ-AR-009; it changes only by an edit
of this requirement and of REQ-AR-009.

The line of an import is the line of the first token of an import or re-export declaration, of an `import("…")` node in
a type position, or of a `/// <reference …>` directive. Every perimeter file SHALL be refused by these rules:
- `non-ts-file` — a perimeter file whose name does not end with `.ts`;
- `import-outside-kernel` — a static `import`, `import type`, `export … from`, `import x = require(…)` or `import("…")`
  in a type position whose specifier is neither exactly `node:crypto` nor a relative specifier (`./`, `../`) whose path
  ends with `.ts` and matches the perimeter list: `crypto`, `node:crypto/…`, packages, other built-in modules, paths
  with another extension and paths outside the perimeter list, outside the root included, are violations; a relative
  specifier is resolved from the path of the file, the decision is by path, and no file has to exist at it; a
  `/// <reference …>` directive is a violation;
- `crypto-import` — an import from `node:crypto` of anything other than the named value import `createHash` (renaming
  included, `import { createHash as h }`): a default, namespace or binding-less import, `import type`, a re-export and
  every other name (`randomBytes`, `randomUUID`, `getRandomValues`) are violations;
- `dynamic-import` — a call `import(…)` or `require(…)`;
- `forbidden-global` — a free identifier outside the closed list of allowed ones: `Object`, `Array`, `String`,
  `Number`, `Boolean`, `Symbol`, `BigInt`, `Math`, `JSON`, `Reflect`, `Map`, `Set`, `WeakMap`, `Error`, `TypeError`,
  `RangeError`, `ArrayBuffer`, `DataView`, `Uint8Array`, `Date`, `undefined`, `NaN`, `Infinity` (`Math` and `Date`
  within the limits of `nondeterminism`); the expression `import.meta`; the list grows only by an edit of this
  requirement;
- `nondeterminism` — a free identifier `Date` anywhere except in a closed list of forms: `new Date(x)` with exactly one
  argument that is neither a spread nor a string literal, and only as the object of a dot access to `toISOString`,
  `getTime`, `valueOf` or `getUTC…` right after it (`new Date(x).toISOString()`); everything else — a call `Date(…)`,
  `Date.now`, `new Date()`, `new Date(y, m, …)`, `new Date("…")`, `new Date(x)` in a variable or an argument, `Date`
  passed as a value (`Reflect.construct(Date, [])`) — is a violation; a free identifier `Math` anywhere except a dot
  access to exactly `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.abs`, `Math.min`, `Math.max`, `Math.sign`
  (`Math.random`, `Math.sin`, `Math["random"]`, `const { random } = Math`, `Math` passed as a value are violations); an
  access to a method that depends on the locale or the time zone, by name and whatever the object, through a dot or a
  computed access `x["<name>"]`: a name starting with `toLocale`, `localeCompare`, `getTimezoneOffset`,
  `toDateString`, `toTimeString`, and the local getters and setters of `Date` — `getFullYear`, `getMonth`, `getDate`,
  `getDay`, `getHours`, `getMinutes`, `getSeconds`, `getMilliseconds`, `setFullYear`, `setMonth`, `setDate`,
  `setHours`, `setMinutes`, `setSeconds`, `setMilliseconds`, `getYear`, `setYear`.

A free identifier is an identifier in a value position not bound in any enclosing scope of the file (module, function,
block, class, `catch`, parameters, imports). A shorthand property `{ process }` is a reference to a value. A property
name after a dot, a key of an object literal (except a shorthand one), a class member name, a member name of an
interface or a type, every type position and a label are not free identifiers. Ambient declarations (`declare …`,
`declare global`, `declare module`) bind no name in a value position; `arguments` is a free identifier. The test
catches an accidental violation, not a deliberate bypass (`Object.constructor(…)`): review guards against the latter.

The check itself SHALL refuse with the code `no-kernel` on the first condition met, in this order: the root of the tree
does not exist (the refusal names the root as given); the perimeter has no `*.ts` file (the refusal names the root);
the entry file does not exist (the refusal names the entry path). On `no-kernel` the result is exactly that one refusal
at line 0, and no rule runs.

A perimeter or source `*.ts` file whose parse gives a TypeScript syntax error SHALL get only the refusal `parse-error`
with its file and the line of the first diagnostic: no other rule applies to it and it has no outgoing edges of the
import graph; it stays a file of the tree — a node of the graph and an end of the edges of other files. The other
files are checked, and their violations are reported together.

Every refusal SHALL name the file (a path), the line and the rule id. The result of the test is the set of distinct
file–line–rule triples: one triple is one refusal, however many imports or nodes produced it; it is ordered by file
(UTF-16 code units), then by line, then by rule. The check SHALL work by parsing source text, without running the
checked files.

Implements: ST-K01, OM-L04

#### Scenario: The project passes the structure test
<!-- id: SCN-AR-008 -->
- **WHEN** the structure test runs on the project with the project policy (sources `src/**`, entry
  `src/kernel/index.ts`, perimeter `src/kernel/**`, the modules and ports of REQ-AR-009)
- **THEN** there are no violations

#### Scenario: Kernel violations are found
<!-- id: SCN-AR-009 -->
- **WHEN** the structure test runs on a kernel fixture tree with the policy: sources and perimeter `**`, entry a file
  without violations importing `{ createHash as h }` (below); the tree holds files with (the expected rule in
  parentheses): an import of `node:fs` (`import-outside-kernel`); an import of `../ledger/commit.ts`
  (`import-outside-kernel`); an import of the package `canonicalize` (`import-outside-kernel`); an import of `crypto`
  (`import-outside-kernel`); `export { x } from "node:path"` (`import-outside-kernel`);
  `import type { T } from "../run/types.ts"` (`import-outside-kernel`); a file in a subfolder `sub/` importing
  `../../outside.ts` (`import-outside-kernel`); an import of `./helper.js` (`import-outside-kernel`); the file
  `helper.js` (`non-ts-file`); `import { randomUUID } from "node:crypto"` (`crypto-import`); `import "node:crypto"`
  (`crypto-import`); `export { createHash } from "node:crypto"` (`crypto-import`); a call `import("./x.ts")`
  (`dynamic-import`); a read of `process.env.HOME` (`forbidden-global`); a call `fetch("…")` (`forbidden-global`);
  `globalThis.x` (`forbidden-global`); `console.log(1)` (`forbidden-global`); `new Function("return 1")`
  (`forbidden-global`); `setTimeout(f, 0)` (`forbidden-global`); `({ process })` (`forbidden-global`); a file with
  `function f(console) { return console }` and `function g() { return console }` (`forbidden-global` — only the line
  in `g`); `new WebSocket("…")` (`forbidden-global`); `import.meta.url` (`forbidden-global`); `structuredClone(x)`
  (`forbidden-global`); `s.localeCompare(t)` (`nondeterminism`); `new Date(0).getHours()` (`nondeterminism`);
  `n.toLocaleString()` (`nondeterminism`); `Date.now()` (`nondeterminism`); `new Date(2026, 0, 1)`
  (`nondeterminism`); `new Date(0).setHours(1)` (`nondeterminism`); `String(new Date(0))` (`nondeterminism`);
  `new Date(0)["getHours"]()` (`nondeterminism`); `const d = new Date(0)` (`nondeterminism`); `Math.sin(1)`
  (`nondeterminism`); `declare const process: any; process.env.HOME` (`forbidden-global`); `arguments.length`
  (`forbidden-global`); `import fs = require("node:fs")` (`import-outside-kernel`);
  `let t: import("../ledger/types.ts").T` (`import-outside-kernel`); `/// <reference path="../x.ts" />`
  (`import-outside-kernel`); `new Date()` (`nondeterminism`); `Date(0)` (`nondeterminism`);
  `Reflect.construct(Date, [])` (`nondeterminism`); `Math.random()` (`nondeterminism`); `Math["random"]()`
  (`nondeterminism`); `const { random } = Math` (`nondeterminism`); and files without violations: an import of
  `{ createHash as h }` from `node:crypto` and of `./hash.ts` with calls `new Date(0).toISOString()`,
  `Math.floor(1.5)`, `JSON.stringify(s)`, `Reflect.ownKeys(o)`, `Number.isSafeInteger(n)` and `new Map()`; a file in
  the subfolder `sub/` importing `../hash.ts`; a file with a local `const process = 1`, its read and the expression
  `x.process`; a file with a class whose method is `process()`, with `interface X { console: number }` and
  `let f: Function`; then the structure test runs with the same policy on a root that does not exist; then on a tree
  with the policy: sources and perimeter `**`, entry a file `other.ts` without a syntax error that imports
  `./broken.ts` and calls `console.log(1)`; a file `broken.ts` with a syntax error on line 1 and an import of
  `../outside.ts` on line 2
- **THEN** every file with a violation is named with its line and expected rule; files without violations are not
  named; the missing root gives exactly one refusal `no-kernel` naming the root; the tree with `broken.ts` gives exactly
  two refusals: `parse-error` of `broken.ts` at line 1 (the import of `../outside.ts` gives neither
  `import-outside-kernel` nor `outside-perimeter`) and `forbidden-global` of `other.ts`

### Requirement: Project tests are declared inside describe
<!-- id: REQ-AR-006 -->

The structure test SHALL parse the files `test/**/*.test.ts` of the project, or the files of a fixture, and refuse by
the rule `test-outside-describe` a `node:test` test call that is not lexically inside a function passed to a suite
call: the junit report of `node:test` puts such a test outside `<testsuite>`, and the check `tests-passed` does not
count it. A test call is `test`, `it` and their forms `.skip`, `.only`, `.todo`; a suite call is `describe`, `suite`
and their forms `.skip`, `.only`, `.todo`. Names are recognised by their import from `node:test`: named, renaming
included (`import { test as t }`), default (`import t from "node:test"` is `test`) and through a namespace
(`import * as nt` — `nt.test`, `nt.describe`). A suite function is a function expression or an arrow function written
directly as an argument of the suite call; a function passed by reference (`describe("x", body)`) is not a suite
function. A name shadowed by a local binding is not a test call. A subtest `t.test(…)` through the test context is not
a test call of this rule. The refusal SHALL name the file and the line of the call.

#### Scenario: A test outside describe is found
<!-- id: SCN-AR-010 -->
- **WHEN** the structure test runs on a fixture with a file where `test(…)`, `test.skip(…)`, `t2(…)` with
  `import { test as t2 } from "node:test"` and `nt.it(…)` with `import * as nt from "node:test"` stand at the top level
  of the module, one `it(…)` is inside an ordinary function outside any suite, and inside suites stand `test(…)` in
  `describe(…)`, `it(…)` in `suite(…)`, `test(…)` in `describe.skip(…)` and a subtest `t.test(…)` inside `test(…)` in
  `describe(…)`; `test(…)` inside a module-level function `body` with `describe("x", body)`; a call `test()` inside
  `function f(test) { … }`; then on the folder `test/` of the project
- **THEN** exactly six violations are found in the fixture — the top-level `test`, `test.skip`, `t2`, `nt.it`, the `it`
  outside a suite and the `test` in `body` — with their lines; the folder `test/` of the project has no violations

### Requirement: The kernel perimeter is everything reachable from the entry
<!-- id: REQ-AR-007 -->

The structure test SHALL build, by parsing source text and without running it, the import graph of the tree: an edge
from a file leads to the path (REQ-AR-005) given by the relative specifier (`./`, `../`) of a static `import`,
`import type`, `export … from`, `import x = require(…)` or `import("…")` in a type position; the path is resolved from
the path of the file, and no file has to exist at it; the line of the edge is the line of the import (REQ-AR-005).
`import type` and an import in a type position are edges like a value import. A non-relative specifier (`node:*`, a
package), a call `import(…)` or `require(…)` and a directive `/// <reference …>` are not edges; in perimeter files the
rules of REQ-AR-005 refuse them. A file with `parse-error` has no outgoing edges.

A reachable path is the entry and every path an edge leads to from a reachable perimeter file; edges are followed from
existing perimeter files regardless of the list of sources, and edges from paths outside the perimeter are not
followed. Every reachable path SHALL match the perimeter list, otherwise the refusal is `outside-perimeter`:
- a path outside the perimeter that an edge from a reachable perimeter file leads to gives a refusal with the file and
  the line of the import that led out of the list (one per line of such an import);
- an entry outside the perimeter gives one refusal naming the entry, at line 0.

A perimeter file not reachable from the entry is not refused by this rule: REQ-AR-005 checks its imports. An import from
a reachable perimeter file into a path outside the list SHALL give both refusals at the same line —
`import-outside-kernel` and `outside-perimeter`.

Implements: ST-K01

#### Scenario: What is reachable from the entry left the list
<!-- id: SCN-AR-011 -->
- **WHEN** the structure test runs on a fixture tree with the policy: sources `**`, entry `kernel/entry.ts`, perimeter
  `kernel/**`; `kernel/entry.ts` imports `./a.ts` and `import type` from `./types.ts`; `kernel/a.ts` imports
  `../outside/b.ts` and on a separate line does `export { y } from "../outside/e.ts"`; `kernel/types.ts` does
  `import type` from `../outside/t.ts`; `kernel/orphan.ts`, imported by nobody, imports `../outside/c.ts`;
  `outside/b.ts` imports `./d.ts`
- **THEN** `kernel/a.ts` gets `import-outside-kernel` and `outside-perimeter` at the line of the import of
  `../outside/b.ts`, and both at the line of `export … from`; `kernel/types.ts` gets both at the line of `import type`;
  `kernel/orphan.ts` gets only `import-outside-kernel`; the files `outside/*` are not named; there are no other
  violations

#### Scenario: The entry is missing or outside the list; the list of sources does not limit the perimeter
<!-- id: SCN-AR-012 -->
- **WHEN** the structure test runs on the fixture tree of SCN-AR-011 with the entry `kernel/missing.ts` (no such
  file), then with the entry `outside/b.ts`, then with the entry `kernel/entry.ts` and the sources `outside/**` (the
  files `kernel/*` are not sources)
- **THEN** the first run gives exactly one refusal `no-kernel` naming `kernel/missing.ts` at line 0; the second gives
  exactly one refusal `outside-perimeter` (file `outside/b.ts`, line 0) plus the same `import-outside-kernel` refusals
  as in SCN-AR-011, and no other violations; the third gives the same violations as SCN-AR-011

### Requirement: No import cycles between files
<!-- id: REQ-AR-008 -->

The structure test SHALL, by parsing source text and without running it, refuse import cycles between files: the
nodes of the graph are the `*.ts` source files (REQ-AR-005; for the project, `src/**`), the edges follow REQ-AR-007
(`import type`, `export … from`, `import x = require(…)` and an import in a type position included) from a node to a
node; a node with `parse-error` has no outgoing edges. A cycle is a path along edges from a file back to it; a file
importing itself is a cycle of one file.

The refusal `import-cycle` SHALL name the file and the line of the import that closes the cycle, and SHALL be
deterministic: the depth-first walk starts from the files in the order of their paths (UTF-16 code units), the edges
of a file go in the order of their positions in the text, and no file is walked twice; an import leading to a file on
the current path of the walk (the file itself included) closes a cycle — a refusal at the line of that import. Every
cycle has at least one refused import; a graph without cycles gives no `import-cycle` refusal.

Implements: ST-S01

#### Scenario: Cycles of one, two and three files are found
<!-- id: SCN-AR-013 -->
- **WHEN** the structure test runs on a fixture tree with the policy: sources `**`, entry and perimeter `entry.ts`
  without imports; `a.ts` imports `./b.ts`, `b.ts` imports `./a.ts`; `c.ts` imports `./d.ts`, `d.ts` imports
  `./e.ts`, `e.ts` imports `./c.ts`; `r1.ts` does `import x = require("./r2.ts")`, `r2.ts` does
  `import y = require("./r1.ts")`; `s.ts` imports `./s.ts`; `t1.ts` does `import type` from `./t2.ts`, `t2.ts` from
  `./t1.ts`; `u1.ts` does `export { x } from "./u2.ts"`, `u2.ts` declares `let t: import("./u1.ts").T`; `f.ts`
  imports `./g.ts` and `./h.ts`, `g.ts` imports `./h.ts`
- **THEN** the violations are exactly six refusals `import-cycle`: `b.ts` at the line of its import of `./a.ts`,
  `e.ts` — `./c.ts`, `r2.ts` — `./r1.ts`, `s.ts` — `./s.ts`, `t2.ts` — `import type` from `./t1.ts`, `u2.ts` —
  `import("./u1.ts")`; `f.ts`, `g.ts`, `h.ts` are not named

#### Scenario: src/ of the project has no cycles
<!-- id: SCN-AR-014 -->
- **WHEN** the structure test runs on the project with the project policy
- **THEN** there is no `import-cycle` refusal

### Requirement: Imports between modules follow the module matrix
<!-- id: REQ-AR-009 -->

When the policy names modules, the structure test SHALL check every source file under `src/` outside the kernel
perimeter against them. A module has a name, a glob of its files, the modules it may import, and whether it may import
`node:` built-ins and packages. A port is a name matching `[a-z]+` and the path of its interface file. An adapter is a
module of its own: the files under `src/adapters/<port>-<name>/`, where `<port>` is a port of the policy and `<name>`
matches `[a-z0-9][a-z0-9-]*`.

The project policy SHALL be the matrix of `design-next` ST-M01 at the granularity of modules; it changes only by an edit
of this requirement:

| Module | Files | May import | `node:` built-ins | Packages |
|---|---|---|---|---|
| `kernel` | `src/kernel/**` | checked by REQ-AR-005, not by this requirement | — | — |
| `trust` | `src/trust/**` | `kernel` | no | no |
| `measure` | `src/measure/**` | `kernel` | no | no |
| `ledger` | `src/ledger/**` | `kernel`, `trust`, `measure` | no | no |
| `codec` | `src/codec/**` | `kernel`, `ledger` | no | no |
| `runtime` | `src/runtime/**` | `kernel`, `ledger` | no | no |
| `capabilities` | `src/capabilities/**` | `kernel`, `measure`, `ledger`, and of `runtime` only its port interface files | no | no |
| adapter `<port>-<name>` | `src/adapters/<port>-<name>/**` | only the interface file of `<port>` | yes | yes |
| `assembly` | `src/assembly/**` | `kernel`, `trust`, `measure`, `ledger`, `codec`, `runtime`, `capabilities`, every adapter | yes | no |
| `cli` | `src/cli/**` | `assembly` | yes | no |

The ports of the project policy are `store` (`src/ledger/ports/store.ts`), `acts` (`src/ledger/ports/acts.ts`),
`clock` (`src/runtime/ports/clock.ts`) and `ids` (`src/runtime/ports/ids.ts`); the port interface files of `runtime`
are those under `src/runtime/ports/`. A module may always import its own files. The finer limits ST-M01 puts on what
`codec`, `runtime` and `capabilities` read of `ledger` (the proposal format, the read view) are not checked in S0.

The rules, each refusal with the file and the line of the import (REQ-AR-005); none of them applies to a perimeter
file, a file with `parse-error`, or a file outside `src/`:
- `outside-matrix` — a source file under `src/` that belongs to no module: a file directly in `src/` or in
  `src/adapters/`, a file in a folder of `src/` not in the matrix, a file in a folder of `src/adapters/` not of the form
  `<port>-<name>` with a port of the policy; at line 0;
- `non-ts-file` — a source file of a module whose name does not end with `.ts`; at line 1;
- `import-direction` — an edge (REQ-AR-007) from a file of one module to a path that is neither a file of the same
  module nor a file of a module the first may import: a path of another module not in its list, a path under `src/` in
  no module, or a path outside `src/`; for an adapter, every edge to a path other than its own files and the interface
  file of its port, so adapters never import each other; for `capabilities`, an edge into `runtime` outside
  `src/runtime/ports/`;
- `package-import` — the non-relative specifier of a static `import`, `import type`, `export … from`,
  `import x = require(…)` or `import("…")` in a type position: a `node:` built-in in a module that may not import
  built-ins; any other non-relative specifier — a package, or a built-in without the `node:` prefix — outside an
  adapter.

Calls `import(…)` and `require(…)` are not edges (REQ-AR-007) and are not checked by these rules; in pure modules
REQ-AR-010 refuses them.

A policy without modules runs none of these rules.

Implements: ST-M01, ST-M02, ST-S01, ST-S02

#### Scenario: Matrix violations are found
<!-- id: SCN-AR-015 -->
- **WHEN** the structure test runs on a fixture tree with the sources `src/**`, the entry `src/kernel/index.ts` (a
  file without violations), the perimeter `src/kernel/**` and the modules and ports of the project policy, where (the
  expected rule in parentheses): a `ledger` file imports a `codec` file (`import-direction`); a `codec` file imports an
  adapter file (`import-direction`); a `cli` file imports a `ledger` file (`import-direction`); a `ledger` file imports
  `../../test/x.ts` (`import-direction`); a file of adapter `store-x` imports a file of adapter `clock-y`
  (`import-direction`); a file of adapter `store-x` imports `src/ledger/index.ts` (`import-direction`); a file of
  adapter `clock-y` imports the `ids` interface file (`import-direction`); a `capabilities` file imports a `runtime` file
  outside `src/runtime/ports/` (`import-direction`); a `trust` file imports `node:fs` (`package-import`); a `ledger`
  file imports a package (`package-import`); an `assembly` file imports a package (`package-import`); a `cli` file
  imports `fs` (`package-import`); the files `src/top.ts`, `src/misc/x.ts`, `src/adapters/judge-x/a.ts` and
  `src/adapters/store/a.ts` (`outside-matrix`); a file `src/ledger/x.js` (`non-ts-file`); and files without
  violations: an `assembly` file importing an adapter, `ledger`, `codec` and `node:fs`; a `cli` file importing
  `assembly` and `node:process`; a file of adapter `store-x` importing the `store` interface file, another file of its
  own adapter, `node:fs` and a package; a `codec` file importing `ledger` and `kernel`; a `ledger` file importing
  `trust`, `measure` and `kernel`; a `capabilities` file importing the `clock` interface file; then on the same tree
  with a policy without modules
- **THEN** every file with a violation is named with its line and expected rule, and files without violations are not
  named; with the policy without modules none of the rules `outside-matrix`, `import-direction`, `package-import` is
  reported, and `src/ledger/x.js` is not named

### Requirement: Modules outside adapters, assembly and cli are pure
<!-- id: REQ-AR-010 -->

When the policy names modules, every source `*.ts` file of a module that may import neither `node:` built-ins nor
packages (REQ-AR-009: `trust`, `measure`, `ledger`, `codec`, `runtime`, `capabilities`) SHALL be refused by the rules
`dynamic-import`, `forbidden-global` and `nondeterminism` exactly as REQ-AR-005 defines them for perimeter files: no
I/O, clock, randomness or environment. Files of adapters, `assembly` and `cli` are not refused by these rules; kernel
files are checked by REQ-AR-005; a file of another extension is refused by `non-ts-file` (REQ-AR-009).

Implements: ST-S03, PL-C04

#### Scenario: Impurity in pure modules is found
<!-- id: SCN-AR-016 -->
- **WHEN** the structure test runs on a fixture tree with the sources `src/**`, the entry `src/kernel/index.ts` (a file
  without violations), the perimeter `src/kernel/**` and the modules and ports of the project policy, where a `ledger`
  file calls
  `Date.now()` (`nondeterminism`), reads `process.env.X` (`forbidden-global`), calls `console.log(1)`
  (`forbidden-global`) and calls `import("./x.ts")` (`dynamic-import`); a `codec` file calls `Math.random()`
  (`nondeterminism`); a `trust` file calls `fetch("…")` (`forbidden-global`); and an `assembly` file, a `cli` file and
  an adapter file each call `Date.now()`, read `process.env.X` and call `console.log(1)`
- **THEN** every refused call of `ledger`, `codec` and `trust` is named with its line and expected rule; the
  `assembly`, `cli` and adapter files are not named

### Requirement: Every rejection rule of apply has a fixture
<!-- id: REQ-AR-011 -->

The rule IDs that apply can name in a rejection SHALL form one closed list — the list of REQ-LG-002 —, exported by the
ledger module; a rejection naming a rule outside the list cannot be built. For every rule ID of the list there SHALL be
a fixture folder `test/fixtures/rules/<RULE-ID>/` holding `ledger.jsonl` (a whole ledger from its first commit,
possibly empty), `proposal.json` (a proposal), `expected.json` (the expected rejections without their `message`, at
least one) and, only where the rule needs it, `moved.jsonl` (the commits another writer appends after `ledger.jsonl`
was opened, REQ-LG-004). `ledger.jsonl`, and `ledger.jsonl` followed by `moved.jsonl`, SHALL each open as a ledger
(REQ-CL-004, **Opening**); a fixture whose ledger does not open fails the test, naming the folder.

A test reads the proposal (REQ-LG-001) and applies it to the ledger of `ledger.jsonl` (REQ-LG-003); when apply answers
a commit, it checks that commit against the ledger of `ledger.jsonl` followed by `moved.jsonl`, or of `ledger.jsonl`
alone when there is no `moved.jsonl` (REQ-LG-004). It SHALL get exactly the expected rejections, compared on every
field but `message`, every one naming the rule ID of its folder, every `message` non-empty. A rule ID of the list
without a fixture folder, and a fixture folder whose name is not on the list, SHALL fail the test, naming the rule ID
or the folder.

Implements: LG-A02, ST-A01

#### Scenario: Each rule of apply is triggered by its fixture
<!-- id: SCN-AR-017 -->
- **WHEN** the rule test runs on the project, then on a declared list holding a rule ID that has no fixture folder,
  then with a fixture folder whose name is not on the declared list, then on a copy of the folder `LG-P02` whose
  `expected.json` is `[]`, then on that copy with the original `expected.json` and a `ledger.jsonl` that does not open
- **THEN** on the project every rule ID of the declared list has exactly one folder and every folder names a declared
  rule ID, every fixture gives exactly its expected rejections, each naming the rule of its folder; the missing folder
  is reported with its rule ID; the extra folder is reported with its name; both copies fail, naming the folder
