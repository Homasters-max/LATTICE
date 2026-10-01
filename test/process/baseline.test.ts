// Process baseline (Change infra-baseline, design D-6): the job `test` runs the tests
// and the type check on every PR and on push to main (D-3); artifacts are English
// (D-4); one AREA per spec (D-5). Lines of test.yml are matched as text, like
// pin.test.ts (I-6, I-10). No spec scenarios (skip_specs), so no SCN tokens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

// Comment and blank lines dropped; trailing spaces trimmed.
const workflow = read(".github/workflows/test.yml")
  .split("\n")
  .map((line) => line.trimEnd())
  .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"));

const indent = (line: string): number => line.length - line.trimStart().length;

// The lines nested under the line `header` (deeper indentation), up to the next sibling.
const block = (header: string): string[] => {
  const start = workflow.indexOf(header);
  assert.ok(start >= 0, `no line ${JSON.stringify(header)}`);
  const body: string[] = [];
  for (const line of workflow.slice(start + 1)) {
    if (indent(line) <= indent(header)) break;
    body.push(line);
  }
  return body;
};

describe("baseline: the job test", () => {
  it("runs on every pull request and on push to main", () => {
    const keys = block("on:").filter((line) => indent(line) === 2).map((line) => line.trim());
    assert.deepEqual([...keys].sort(), ["pull_request:", "push:"]);
    assert.deepEqual(block("  push:").map((line) => line.trim()), ["branches: [main]"]);
  });

  it("has exactly the top-level permission contents: read, and no job sets its own", () => {
    assert.deepEqual(block("permissions:").map((line) => line.trim()), ["contents: read"]);
    const jobLevel = workflow.filter((line) => line.trim() === "permissions:" && indent(line) > 0);
    assert.deepEqual(jobLevel, [], "a job-level permissions block");
  });

  it("sets up Node 22 in the setup-node step", () => {
    const step = block("      - uses: actions/setup-node@v4").map((line) => line.trim());
    assert.ok(/^node-version: "?22"?$/.test(step.find((line) => line.startsWith("node-version:")) ?? ""), "not Node 22");
  });

  it("runs npm ci, the type check and the tests, in this order, and nothing else", () => {
    const runs = workflow
      .map((line) => /^\s*(?:- )?run:\s*(.*)$/.exec(line)?.[1])
      .filter((command) => command !== undefined);
    assert.deepEqual(runs, ["npm ci", "npm run typecheck", "npm test"]);
  });

  it("cancels a run in progress only for a pull request, and groups a push to main by commit", () => {
    assert.deepEqual(block("concurrency:").map((line) => line.trim()), [
      "group: test-${{ github.event_name == 'pull_request' && github.ref || github.sha }}",
      "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
    ]);
  });
});

describe("baseline: language of artifacts", () => {
  it("the project context of openspec rules starts with Language: English", () => {
    const rules = JSON.parse(read(".warrant/local/openspec/rules.json")) as { $schema: string; context: string };
    assert.equal(rules.$schema, "warrant://openspec-rules/1");
    assert.ok(rules.context.startsWith("Language: English\n"), "context does not start with Language: English");
  });

  it("the generated openspec/config.yaml carries the same line", () => {
    const config = read("openspec/config.yaml").split("\n");
    assert.ok(config.includes("  Language: English"), "config.yaml lacks Language: English");
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
});
