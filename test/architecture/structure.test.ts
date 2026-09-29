// Structure test (REQ-AR-001…REQ-AR-004): the expected violations of a fixture tree are the
// `// expect: <rule>[ <rule>…]` marks on its lines (design D-8), so a fixture states its own vector; refusals at line 0
// are stated explicitly.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkStructure, checkTests, listFiles, projectTestFiles } from "./structure.ts";
import type { Policy, Violation } from "./structure.ts";
import { projectPolicy } from "./policy.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fixture = (p: string): string => join(root, "test", "fixtures", "structure", p);
const MARK = /\/\/ expect: ([a-z-]+(?: [a-z-]+)*)/;

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The result order of REQ-AR-001: file (UTF-16 code units), line as a number, rule (UTF-16 code units). */
const ordered = (vs: readonly Violation[]): Violation[] =>
  [...vs].sort((a, b) => byCodeUnits(a.file, b.file) || a.line - b.line || byCodeUnits(a.rule, b.rule));

/** Every rule of every mark in the files of `dir` (file relative to `dir`, forward slashes), in the result order. */
function marks(dir: string): Violation[] {
  const out: Violation[] = [];
  for (const file of listFiles(dir)) {
    const rel = relative(dir, file).split("\\").join("/");
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const m = MARK.exec(line);
        for (const rule of m?.[1]?.split(" ") ?? []) out.push({ file: rel, line: i + 1, rule });
      });
  }
  return ordered(out);
}

const noKernel = (file: string): Violation[] => [{ file, line: 0, rule: "no-kernel" }];

const KERNEL: Policy = { sources: ["**"], entry: "clean.fixture.ts", perimeter: ["**"] };
const BROKEN: Policy = { sources: ["**"], entry: "other.fixture.ts", perimeter: ["**"] };
const PERIMETER: Policy = { sources: ["**"], entry: "kernel/entry.ts", perimeter: ["kernel/**"] };
const CYCLES: Policy = { sources: ["**"], entry: "entry.ts", perimeter: ["entry.ts"] };

describe("SCN-AR-001 kernel of the project", () => {
  it("SCN-AR-001 the project policy gives no violations", () => {
    assert.deepEqual(checkStructure(root, projectPolicy), []);
  });
});

describe("SCN-AR-002 kernel violations", () => {
  it("SCN-AR-002 every fixture violation is named with its line and rule, clean files are not named", () => {
    const dir = fixture("kernel");
    assert.deepEqual(checkStructure(dir, KERNEL), marks(dir));
  });

  it("SCN-AR-002 missing root is no-kernel naming the root", () => {
    const dir = fixture("missing");
    assert.deepEqual(checkStructure(dir, KERNEL), noKernel(dir));
  });

  it("SCN-AR-002 root that is a file is no-kernel naming the root", () => {
    const file = fixture(join("kernel", "clean.fixture.ts"));
    assert.deepEqual(checkStructure(file, KERNEL), noKernel(file));
  });

  it("SCN-AR-002 parse error is the only refusal of its file, the other files are still checked", () => {
    const dir = fixture("broken");
    const found = checkStructure(dir, BROKEN);
    assert.deepEqual(found, marks(dir));
    assert.equal(found.length, 2);
  });
});

describe("SCN-AR-003 tests inside describe", () => {
  it("SCN-AR-003 fixture: exactly the marked calls, with lines", () => {
    const file = fixture(join("tests", "describe.fixture.ts"));
    const found = ordered(checkTests([file]).map((v) => ({ ...v, file: "describe.fixture.ts" })));
    assert.deepEqual(found, marks(fixture("tests")));
    assert.equal(found.length, 6);
  });

  it("SCN-AR-003 test/ of the project has no violations", () => {
    assert.deepEqual(checkTests(projectTestFiles(join(root, "test"))), []);
  });
});

describe("SCN-AR-004 reachable from the entry left the perimeter", () => {
  it("SCN-AR-004 an import out of a reachable file gives both rules, of an unreachable one only the import rule", () => {
    const dir = fixture("perimeter");
    assert.deepEqual(checkStructure(dir, PERIMETER), marks(dir));
  });

  it("SCN-AR-004 import types in aliases, interfaces, declarations are imports; paths exist case-sensitively", () => {
    const dir = fixture("perimeter-edges");
    assert.deepEqual(checkStructure(dir, PERIMETER), marks(dir));
  });
});

describe("SCN-AR-005 entry missing, outside the perimeter; sources do not limit the perimeter", () => {
  const dir = fixture("perimeter");
  const outsideEntry = (): Violation[] =>
    ordered([
      ...marks(dir).filter((v) => v.rule === "import-outside-kernel"),
      { file: "outside/b.ts", line: 0, rule: "outside-perimeter" },
    ]);

  it("SCN-AR-005 missing entry is no-kernel naming the entry", () => {
    assert.deepEqual(checkStructure(dir, { ...PERIMETER, entry: "kernel/missing.ts" }), noKernel("kernel/missing.ts"));
  });

  it("SCN-AR-005 entry outside the perimeter is outside-perimeter at line 0", () => {
    assert.deepEqual(checkStructure(dir, { ...PERIMETER, entry: "outside/b.ts" }), outsideEntry());
  });

  it("SCN-AR-005 entry outside both lists still exists", () => {
    const policy = { ...PERIMETER, sources: ["kernel/**"], entry: "outside/b.ts" };
    assert.deepEqual(checkStructure(dir, policy), outsideEntry());
  });

  it("SCN-AR-005 sources outside the perimeter do not change its violations", () => {
    assert.deepEqual(checkStructure(dir, { ...PERIMETER, sources: ["outside/**"] }), marks(dir));
  });

  it("SCN-AR-005 no-kernel conditions in order: root, .ts files of the perimeter, entry", () => {
    const missing = fixture("missing");
    assert.deepEqual(checkStructure(missing, { ...PERIMETER, entry: "kernel/missing.ts" }), noKernel(missing));
    const kernel = fixture("kernel");
    assert.deepEqual(checkStructure(kernel, { ...KERNEL, perimeter: ["*.js"], entry: "missing.ts" }), noKernel(kernel));
  });
});

describe("SCN-AR-006 cycles of one, two and three files", () => {
  it("SCN-AR-006 exactly the import closing each cycle, for every kind of edge", () => {
    const dir = fixture("cycles");
    const found = checkStructure(dir, CYCLES);
    assert.deepEqual(found, marks(dir));
    assert.equal(found.filter((v) => v.rule === "import-cycle").length, 6);
  });

  it("SCN-AR-006 a source file with a parse error has no edges, a cycle through it does not close", () => {
    const dir = fixture("cycles-broken");
    assert.deepEqual(checkStructure(dir, CYCLES), [{ file: "q.ts", line: 1, rule: "parse-error" }]);
  });
});

describe("SCN-AR-007 no cycles in src/ of the project", () => {
  it("SCN-AR-007 the project policy gives no import-cycle", () => {
    assert.deepEqual(
      checkStructure(root, projectPolicy).filter((v) => v.rule === "import-cycle"),
      [],
    );
  });
});
