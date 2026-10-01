// Process baseline (Change infra-baseline, design D-6): the job `test` runs the tests
// and the type check on every PR and on push to main (D-3); artifacts are English
// (D-4); one AREA per spec (D-5). Lines of test.yml are matched as text, like
// pin.test.ts (I-6). No spec scenarios (skip_specs), so no SCN tokens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

// Comment lines dropped; trailing spaces trimmed.
const testWorkflow = read(".github/workflows/test.yml")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .map((line) => line.trimEnd());

const indexOf = (line: string): number => testWorkflow.indexOf(line);

describe("baseline: the job test", () => {
  it("runs on every pull request and on push to main", () => {
    const on = indexOf("on:");
    assert.ok(on >= 0, "no on:");
    assert.equal(testWorkflow[on + 1], "  pull_request:");
    assert.equal(testWorkflow[on + 2], "  push:");
    assert.equal(testWorkflow[on + 3], "    branches: [main]");
  });

  it("has exactly the top-level permission contents: read", () => {
    const permissions = indexOf("permissions:");
    assert.ok(permissions >= 0, "no top-level permissions:");
    assert.equal(testWorkflow[permissions + 1], "  contents: read");
    assert.ok(!/^\s{2}\S/.test(testWorkflow[permissions + 2] ?? ""), "more than one top-level permission");
    assert.equal(testWorkflow.filter((line) => /^\s*permissions:/.test(line)).length, 1, "a job-level permissions block");
  });

  it("sets up Node 22", () => {
    assert.ok(testWorkflow.includes("      - uses: actions/setup-node@v4"), "no actions/setup-node@v4");
    assert.ok(testWorkflow.includes("          node-version: 22"), "node-version is not 22");
  });

  it("runs npm ci, the type check and the tests, in this order", () => {
    const runs = testWorkflow.filter((line) => /^\s*- run: /.test(line)).map((line) => line.trim());
    assert.deepEqual(runs, ["- run: npm ci", "- run: npm run typecheck", "- run: npm test"]);
  });

  it("cancels a run in progress only for a pull request, and groups a push to main by commit", () => {
    assert.ok(
      testWorkflow.includes("  group: test-${{ github.event_name == 'pull_request' && github.ref || github.sha }}"),
      "concurrency group is not per ref for a PR and per commit for a push",
    );
    assert.ok(
      testWorkflow.includes("  cancel-in-progress: ${{ github.event_name == 'pull_request' }}"),
      "cancel-in-progress is not limited to pull requests",
    );
  });
});

describe("baseline: language of artifacts", () => {
  it("the project context of openspec rules starts with Language: English", () => {
    const rules = JSON.parse(read(".warrant/local/openspec/rules.json")) as { $schema: string; context: string };
    assert.equal(rules.$schema, "warrant://openspec-rules/1");
    assert.ok(rules.context.startsWith("Language: English\n"), "context does not start with Language: English");
  });

  it("the generated openspec/config.yaml carries the same line", () => {
    assert.ok(read("openspec/config.yaml").split("\n").includes("  Language: English"), "config.yaml lacks Language: English");
  });
});

// The whole map (design D-5): a change of the map changes this test in the same Change.
const areas: Record<string, string> = {
  AC: "acts",
  AD: "adapters",
  AR: "architecture",
  BN: "bench",
  CA: "capabilities",
  CD: "codec",
  CL: "cli",
  CT: "catalog",
  KR: "kernel",
  LG: "ledger",
  LN: "lens",
  MS: "measure",
  PJ: "projections",
  RN: "runtime",
  SR: "store",
  TR: "trust",
};

describe("baseline: AREAs", () => {
  it("areas.json maps exactly one AREA per spec of design D-5", () => {
    const file = JSON.parse(read(".warrant/local/areas.json")) as Record<string, unknown>;
    assert.equal(file.$schema, "warrant://areas/1");
    const actual = Object.fromEntries(
      Object.entries(file)
        .filter(([key]) => key !== "$schema")
        .map(([key, value]) => [key, (value as { capability: string }).capability]),
    );
    assert.deepEqual(actual, areas);
  });

  it("no two AREAs name the same spec", () => {
    const specs = Object.values(areas);
    assert.equal(new Set(specs).size, specs.length);
  });
});
