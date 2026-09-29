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

// The judge is a call of the reusable workflow of WARRANT (Change pin-v0-8-2,
// design D-3, D-4): comment lines are dropped, the tag is read from `uses` and
// from the input `warrant` of the block `with` (indent 6), and the file holds no
// copy of the job.
const workflowLines = read(".github/workflows/warrant.yml")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"));
const workflow = workflowLines.join("\n");
const lockKernel = (JSON.parse(read(".warrant/warrant.lock.json")) as { kernel: string }).kernel;

describe("pin: CI judge and lock", () => {
  it("the single tag of the called workflow equals v + kernel of the lock", () => {
    const tags = [
      ...workflow.matchAll(/^\s*uses:\s*Homasters-max\/SRA\/\.github\/workflows\/warrant\.yml@v(\d+\.\d+\.\d+)\s*$/gm),
    ].map((m) => m[1]);
    assert.deepEqual(tags, [lockKernel]);
  });

  it("the single input warrant of the call equals v + kernel of the lock", () => {
    const inputs = workflowLines
      .map((line) => /^ {6}warrant:\s*v(\d+\.\d+\.\d+)\s*$/.exec(line))
      .filter((m) => m !== null)
      .map((m) => m[1]);
    assert.deepEqual(inputs, [lockKernel]);
  });

  it("warrant.yml is a call, not a copy of the job", () => {
    assert.ok(!/^\s*steps:/m.test(workflow), "steps: found");
    assert.ok(!workflow.includes("npm pack"), "npm pack found");
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
