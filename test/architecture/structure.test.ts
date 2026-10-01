// Structure test (REQ-AR-005…REQ-AR-010): the expected violations of a fixture tree are the
// `// expect: <rule>[ <rule>…]` marks on its lines (design D-8), so a fixture states its own vector; refusals at line 0
// are stated explicitly.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkStructure, checkTests, listFiles, projectTestFiles } from "./structure.ts";
import type { Policy, Violation } from "./structure.ts";
import { projectModules, projectPolicy } from "./policy.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fixture = (p: string): string => join(root, "test", "fixtures", "structure", p);
const MARK = /\/\/ expect: ([a-z-]+(?: [a-z-]+)*)/;

// The order and the `no-kernel` refusal are restated here, not imported: the test keeps an oracle independent of
// structure.ts on purpose.
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

describe("SCN-AR-008 kernel of the project", () => {
  it("SCN-AR-008 the project policy gives no violations", () => {
    assert.deepEqual(checkStructure(root, projectPolicy), []);
  });
});

describe("SCN-AR-009 kernel violations", () => {
  it("SCN-AR-009 every fixture violation is named with its line and rule, clean files are not named", () => {
    const dir = fixture("kernel");
    assert.deepEqual(checkStructure(dir, KERNEL), marks(dir));
  });

  it("SCN-AR-009 missing root is no-kernel naming the root", () => {
    const dir = fixture("missing");
    assert.deepEqual(checkStructure(dir, KERNEL), noKernel(dir));
  });

  it("SCN-AR-009 root that is a file is no-kernel naming the root", () => {
    const file = fixture(join("kernel", "clean.fixture.ts"));
    assert.deepEqual(checkStructure(file, KERNEL), noKernel(file));
  });

  it("SCN-AR-009 a ** segment matches zero segments too", () => {
    const kernel = fixture("kernel");
    assert.deepEqual(checkStructure(kernel, { ...KERNEL, sources: ["**/*"], perimeter: ["**/*"] }), marks(kernel));
    const cycles = fixture("cycles");
    assert.deepEqual(checkStructure(cycles, { ...CYCLES, perimeter: ["**/entry.ts"] }), marks(cycles));
  });

  it("SCN-AR-009 globs and the entry are paths: normalised the same way", () => {
    const kernel = fixture("kernel");
    const policy: Policy = { sources: ["./**"], entry: "./sub/../clean.fixture.ts", perimeter: [".//sub/../**"] };
    assert.deepEqual(checkStructure(kernel, policy), marks(kernel));
    // `..` cannot cancel a wildcard segment: such a glob matches nothing, so the perimeter has no files
    assert.deepEqual(checkStructure(kernel, { ...KERNEL, perimeter: ["**/../**"] }), noKernel(kernel));
    assert.deepEqual(checkStructure(kernel, { ...KERNEL, perimeter: ["*/../**", "sub/*/../**"] }), noKernel(kernel));
  });

  it("SCN-AR-009 many ** segments against a deep path are matched in polynomial time", () => {
    // 20 `**` against 40 segments: a backtracking matcher would not finish, a correct one answers at once
    const tmp = mkdtempSync(join(tmpdir(), "structure-"));
    try {
      const dirs = Array.from({ length: 39 }, () => "d");
      mkdirSync(join(tmp, ...dirs), { recursive: true });
      writeFileSync(join(tmp, ...dirs, "x.ts"), "export const x = 1;\n");
      const entry = [...dirs, "x.ts"].join("/");
      const perimeter = ["**/".repeat(20) + "y.ts", "**/".repeat(20) + "x.ts"];
      assert.deepEqual(checkStructure(tmp, { sources: ["**"], entry, perimeter }), []);
      const none = { sources: ["**"], entry, perimeter: perimeter.slice(0, 1) };
      assert.deepEqual(checkStructure(tmp, none), noKernel(tmp));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("SCN-AR-009 a symbolic link is neither a directory nor a file of the tree", () => {
    // the linked directory holds a file with a syntax error: walked, it would give parse-error
    const tmp = mkdtempSync(join(tmpdir(), "structure-"));
    try {
      const tree = join(tmp, "tree");
      const target = join(tmp, "target");
      mkdirSync(join(tree, "kernel"), { recursive: true });
      mkdirSync(target);
      writeFileSync(join(tree, "kernel", "entry.ts"), "export const v = 1;\n");
      writeFileSync(join(target, "bad.ts"), "export const = ;\n");
      symlinkSync(target, join(tree, "kernel", "linked"), "junction"); // a junction on Windows needs no admin rights
      const policy: Policy = { sources: ["**"], entry: "kernel/entry.ts", perimeter: ["**"] };
      assert.deepEqual(checkStructure(tree, policy), []);
      assert.deepEqual(checkStructure(tree, { ...policy, sources: ["kernel/linked/**"] }), []);
      const linked = "kernel/linked/bad.ts";
      assert.deepEqual(checkStructure(tree, { ...policy, entry: linked }), noKernel(linked));
      const linkedRoot = join(tree, "kernel", "linked");
      assert.deepEqual(checkStructure(linkedRoot, { ...policy, entry: "bad.ts" }), noKernel(linkedRoot));
      assert.deepEqual(checkStructure(`${linkedRoot}/`, { ...policy, entry: "bad.ts" }), noKernel(`${linkedRoot}/`));
      assert.deepEqual(listFiles(tree), [join(tree, "kernel", "entry.ts")]);
      assert.deepEqual(listFiles(linkedRoot), []);
      assert.deepEqual(listFiles(`${linkedRoot}/`), []);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("SCN-AR-009 parse error is the only refusal of its file, the other files are still checked", () => {
    const dir = fixture("broken");
    const found = checkStructure(dir, BROKEN);
    assert.deepEqual(found, marks(dir));
    assert.equal(found.length, 2);
  });
});

describe("SCN-AR-010 tests inside describe", () => {
  it("SCN-AR-010 fixture: exactly the marked calls, with lines", () => {
    const file = fixture(join("tests", "describe.fixture.ts"));
    const found = ordered(checkTests([file]).map((v) => ({ ...v, file: "describe.fixture.ts" })));
    assert.deepEqual(found, marks(fixture("tests")));
    assert.equal(found.length, 6);
  });

  it("SCN-AR-010 test/ of the project has no violations", () => {
    assert.deepEqual(checkTests(projectTestFiles(join(root, "test"))), []);
  });
});

describe("SCN-AR-011 reachable from the entry left the perimeter", () => {
  it("SCN-AR-011 an import out of a reachable file gives both rules, of an unreachable one the import rule", () => {
    const dir = fixture("perimeter");
    assert.deepEqual(checkStructure(dir, PERIMETER), marks(dir));
  });

  it("SCN-AR-011 import types in aliases, interfaces, declarations are imports; paths exist case-sensitively", () => {
    const dir = fixture("perimeter-edges");
    assert.deepEqual(checkStructure(dir, PERIMETER), marks(dir));
  });

  // also: a specifier ending in `/` names no file (import-outside-kernel, no edge); `.//z.ts` collapses to an edge
  it("SCN-AR-011 import(…), require(…) calls and /// <reference …> are not edges; their own refusals stay", () => {
    const dir = fixture("perimeter-non-edges");
    assert.deepEqual(checkStructure(dir, PERIMETER), marks(dir));
  });
});

describe("SCN-AR-012 entry missing, outside the perimeter; sources do not limit the perimeter", () => {
  const dir = fixture("perimeter");
  const outsideEntry = (): Violation[] =>
    ordered([
      ...marks(dir).filter((v) => v.rule === "import-outside-kernel"),
      { file: "outside/b.ts", line: 0, rule: "outside-perimeter" },
    ]);

  it("SCN-AR-012 missing entry is no-kernel naming the entry", () => {
    assert.deepEqual(checkStructure(dir, { ...PERIMETER, entry: "kernel/missing.ts" }), noKernel("kernel/missing.ts"));
  });

  it("SCN-AR-012 entry outside the perimeter is outside-perimeter at line 0", () => {
    assert.deepEqual(checkStructure(dir, { ...PERIMETER, entry: "outside/b.ts" }), outsideEntry());
  });

  it("SCN-AR-012 entry outside both lists still exists", () => {
    const policy = { ...PERIMETER, sources: ["kernel/**"], entry: "outside/b.ts" };
    assert.deepEqual(checkStructure(dir, policy), outsideEntry());
  });

  it("SCN-AR-012 sources outside the perimeter do not change its violations", () => {
    assert.deepEqual(checkStructure(dir, { ...PERIMETER, sources: ["outside/**"] }), marks(dir));
  });

  it("SCN-AR-012 a perimeter glob whose static part is a file matches it, whatever the sources", () => {
    const tree = fixture("perimeter-file-glob");
    const perimeter = ["kernel/**", "lib/api.ts/**"];
    const policy: Policy = { sources: ["kernel/**"], entry: "kernel/entry.ts", perimeter };
    assert.deepEqual(checkStructure(tree, policy), marks(tree));
    assert.deepEqual(checkStructure(tree, { ...policy, sources: ["**"] }), marks(tree));
  });

  it("SCN-AR-012 no-kernel conditions in order: root, .ts files of the perimeter, entry", () => {
    const missing = fixture("missing");
    assert.deepEqual(checkStructure(missing, { ...PERIMETER, entry: "kernel/missing.ts" }), noKernel(missing));
    const kernel = fixture("kernel");
    assert.deepEqual(checkStructure(kernel, { ...KERNEL, perimeter: ["*.js"], entry: "missing.ts" }), noKernel(kernel));
  });
});

describe("SCN-AR-013 cycles of one, two and three files", () => {
  it("SCN-AR-013 exactly the import closing each cycle, for every kind of edge", () => {
    const dir = fixture("cycles");
    const found = checkStructure(dir, CYCLES);
    assert.deepEqual(found, marks(dir));
    assert.equal(found.filter((v) => v.rule === "import-cycle").length, 6);
  });

  it("SCN-AR-013 a source file with a parse error has no edges, a cycle through it does not close", () => {
    const dir = fixture("cycles-broken");
    assert.deepEqual(checkStructure(dir, CYCLES), [{ file: "q.ts", line: 1, rule: "parse-error" }]);
  });

  it("SCN-AR-013 only source files are nodes: a cycle through a file outside the sources does not close", () => {
    const dir = fixture("cycles-sources");
    const policy: Policy = { sources: ["src/**"], entry: "src/entry.ts", perimeter: ["src/entry.ts"] };
    assert.deepEqual(checkStructure(dir, policy), marks(dir));
    const all = ordered([...marks(dir), { file: "src/a.ts", line: 1, rule: "import-cycle" }]);
    assert.deepEqual(checkStructure(dir, { ...policy, sources: ["**"] }), all);
  });
});

describe("SCN-AR-015 matrix violations", () => {
  const dir = fixture("matrix");
  const tree: Policy = {
    sources: ["src/**"],
    entry: "src/kernel/index.ts",
    perimeter: ["src/kernel/**"],
    modules: projectModules,
  };
  const outside = ["src/adapters/judge-x/a.ts", "src/adapters/store/a.ts", "src/misc/x.ts", "src/top.ts"].map(
    (file): Violation => ({ file, line: 0, rule: "outside-matrix" }),
  );

  it("SCN-AR-015 every marked import and file is named with its line and rule, clean files are not named", () => {
    assert.deepEqual(checkStructure(dir, tree), ordered([...marks(dir), ...outside]));
  });

  it("SCN-AR-015 a policy without modules runs none of the matrix rules", () => {
    const { modules: _, ...withoutModules } = tree;
    assert.deepEqual(checkStructure(dir, withoutModules), []);
  });
});

describe("SCN-AR-016 impurity in pure modules", () => {
  it("SCN-AR-016 pure modules keep the purity rules; adapters, assembly and cli do not", () => {
    const dir = fixture("purity");
    const tree: Policy = {
      sources: ["src/**"],
      entry: "src/kernel/index.ts",
      perimeter: ["src/kernel/**"],
      modules: projectModules,
    };
    const found = checkStructure(dir, tree);
    assert.deepEqual(found, marks(dir));
    assert.equal(found.filter((v) => /^src\/(assembly|cli|adapters)\//.test(v.file)).length, 0);
  });
});

describe("SCN-AR-014 no cycles in src/ of the project", () => {
  it("SCN-AR-014 the project policy gives no import-cycle", () => {
    assert.deepEqual(
      checkStructure(root, projectPolicy).filter((v) => v.rule === "import-cycle"),
      [],
    );
  });
});
