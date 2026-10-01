// The round trip of the fixture md through the `lattice` entry as a child process (REQ-CL-006, SL-T09): the walking
// skeleton end to end — command, apply, store, projection, export.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const entry = join(repo, "src", "cli", "main.ts");
const FIXTURE = join(repo, "test", "fixtures", "md", "fixture.md");

function lattice(cwd: string, ...argv: string[]): { code: number | null; out: string; err: string } {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", entry, ...argv], {
    cwd,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe("SCN-CL-010 the round trip gives the same bytes", () => {
  it("SCN-CL-010 init, import-md, apply, export through the entry: every code 0, the export equals the fixture", () => {
    const dir = mkdtempSync(join(tmpdir(), "lattice-e2e-"));
    try {
      copyFileSync(FIXTURE, join(dir, "fixture.md"));
      const steps: { code: number | null; out: string; err: string }[] = [];
      steps.push(lattice(dir, "init", "--namespace", "lattice", "--owner", "Homasters-max"));
      steps.push(lattice(dir, "import-md", "fixture.md"));
      const proposal = steps[1]?.out.trim() as string;
      assert.deepEqual(readdirSync(join(dir, "store", "proposals")), [proposal.slice("store/proposals/".length)]);
      steps.push(lattice(dir, "apply", proposal));
      steps.push(lattice(dir, "export", "--out", "out"));
      for (const s of steps) assert.equal(s.code, 0, s.err);
      assert.equal(steps[3]?.out, "out/fixture.md\n");
      assert.ok(readFileSync(join(dir, "out", "fixture.md")).equals(readFileSync(FIXTURE)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
