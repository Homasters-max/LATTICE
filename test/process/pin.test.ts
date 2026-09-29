// Pin invariant of the WARRANT judge (Change pin-v0-8-1, design D-3): the CI tag
// equals the CLI version that wrote the lock. Delivery of project rules (Change
// fix-pin-test, design D-1): every rule in .warrant/local/rules/ is a rule/1 for
// every path and its text is in AGENTS.md. No spec scenarios (skip_specs), so no
// SCN tokens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

// The judge is a copy of the job that packs the tag and installs the tarball
// (Change pin-v0-8-2, design I-5, D-4): the reusable workflow of WARRANT v0.8.2
// installs the CLI by a bare `npm i -g github:…`, which leaves a binary without
// dependencies on the runner. Comment lines are dropped before the checks.
const workflow = read(".github/workflows/warrant.yml")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");
const lockKernel = (JSON.parse(read(".warrant/warrant.lock.json")) as { kernel: string }).kernel;

describe("pin: CI judge and lock", () => {
  it("the single CLI tag in warrant.yml equals v + kernel of the lock", () => {
    const tags = [...workflow.matchAll(/npm pack github:Homasters-max\/SRA#v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
    assert.deepEqual(tags, [lockKernel]);
  });

  it("the CLI is installed from the packed tarball, not by a bare git install", () => {
    assert.ok(/npm i -g "\.\/\$tgz"/.test(workflow), "install of the tarball not found");
    assert.ok(!/npm i -g\s+"?github:/.test(workflow), "bare npm i -g github: found");
    assert.ok(!/^\s*uses:\s*Homasters-max\/SRA\//m.test(workflow), "call of the reusable workflow found");
  });
});

const rulesDir = ".warrant/local/rules/";
const ruleIds = existsSync(new URL(rulesDir, root))
  ? readdirSync(new URL(rulesDir, root))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort()
  : [];

describe("pin: project rules", () => {
  it("there is at least one project rule", () => {
    assert.ok(ruleIds.length > 0, `no *.json in ${rulesDir}`);
  });

  for (const id of ruleIds) {
    it(`rule ${id} is a warrant://rule/1 for every path, its text is in AGENTS.md`, () => {
      const rule = JSON.parse(read(`${rulesDir}${id}.json`)) as Record<string, unknown>;
      assert.equal(rule.$schema, "warrant://rule/1");
      assert.equal(rule.id, id);
      assert.deepEqual(rule.paths, ["**"]);
      assert.equal(typeof rule.text, "string");
      const text = rule.text as string;
      assert.ok(text.trim().length > 0);
      assert.ok(read("AGENTS.md").includes(text.trim()), `AGENTS.md lacks the text of ${id}`);
    });
  }
});
