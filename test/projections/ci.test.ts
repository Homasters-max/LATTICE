// The third way of LG-J02 — two operating systems (REQ-PJ-005, design D-9): the workflow `test` keeps its job `test`
// and has a job `projections-windows` on `windows-latest` running the projection tests. Read as text, line by line.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WORKFLOW = fileURLToPath(new URL("../../.github/workflows/test.yml", import.meta.url));

/** The lines of a job under `jobs:`, from `  <name>:` to the next job. */
function job(lines: readonly string[], name: string): string[] | null {
  const start = lines.indexOf(`  ${name}:`);
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^ {2}\S/.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).filter((line) => line.trim() !== "");
}

describe("projections: CI on two operating systems", () => {
  it("SCN-PJ-010 the workflow runs the projection tests on Windows", () => {
    const lines = readFileSync(WORKFLOW, "utf8").split(/\r?\n/);
    assert.notEqual(job(lines, "test"), null);
    const windows = job(lines, "projections-windows");
    assert.ok(windows !== null, "no job projections-windows");
    assert.ok(windows.some((line) => line.trim() === "runs-on: windows-latest"));
    const last = (windows.filter((line) => /^\s+- /.test(line)).at(-1) ?? "").trim();
    assert.match(last, /^- run: node --experimental-strip-types --test "test\/projections\/\*\*\/\*\.test\.ts"$/);
  });
});
