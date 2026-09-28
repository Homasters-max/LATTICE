// Structure test (REQ-AR-001, REQ-AR-002): the expected violations of a fixture are the `// expect: <rule>` marks on
// its lines, so a fixture states its own vector.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkKernel, checkTests, listFiles, projectTestFiles } from "./structure.ts";
import type { Violation } from "./structure.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fixture = (p: string): string => join(root, "test", "fixtures", "structure", p);
const MARK = /\/\/ expect: ([a-z-]+)/;

/** `file:line:rule` of every mark in the files of `dir` (file relative to `dir`, forward slashes). */
function marks(dir: string): string[] {
  const out: string[] = [];
  for (const file of listFiles(dir)) {
    const rel = relative(dir, file).split("\\").join("/");
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const m = MARK.exec(line);
        if (m !== null) out.push(`${rel}:${i + 1}:${m[1]}`);
      });
  }
  return out.sort();
}

const keys = (vs: readonly Violation[]): string[] => vs.map((v) => `${v.file}:${v.line}:${v.rule}`).sort();

describe("SCN-AR-001 kernel of the project", () => {
  it("SCN-AR-001 src/kernel has no violations", () => {
    assert.deepEqual(checkKernel(join(root, "src", "kernel")), []);
  });
});

describe("SCN-AR-002 kernel violations", () => {
  it("SCN-AR-002 every fixture violation is named with its line and rule, clean files are not named", () => {
    const dir = fixture("kernel");
    assert.deepEqual(keys(checkKernel(dir)), marks(dir));
  });

  it("SCN-AR-002 missing directory is no-kernel", () => {
    const dir = fixture("missing");
    assert.deepEqual(checkKernel(dir), [{ file: dir, line: 0, rule: "no-kernel" }]);
  });

  it("SCN-AR-002 parse error is named, the other files are still checked", () => {
    const dir = fixture("broken");
    assert.deepEqual(keys(checkKernel(dir)), marks(dir));
  });
});

describe("SCN-AR-003 tests inside describe", () => {
  it("SCN-AR-003 fixture: exactly the marked calls, with lines", () => {
    const file = fixture(join("tests", "describe.fixture.ts"));
    const found = checkTests([file]).map((v) => `describe.fixture.ts:${v.line}:${v.rule}`).sort();
    assert.deepEqual(found, marks(fixture("tests")));
    assert.equal(found.length, 6);
  });

  it("SCN-AR-003 test/ of the project has no violations", () => {
    assert.deepEqual(checkTests(projectTestFiles(join(root, "test"))), []);
  });
});
