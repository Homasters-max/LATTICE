// Pin invariant of the WARRANT judge (Change pin-v0-10-0, design D-4): the CI tag
// equals the CLI version that wrote the lock. Human acceptance (design D-5): the
// profile human-acceptance puts human-approval on the merge of the policy paths.
// Delivery of project rules (Change fix-pin-test, design D-1): every rule in
// .warrant/local/rules/ is a rule/1 for every path and its text is in AGENTS.md.
// No spec scenarios (skip_specs), so no SCN tokens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

// The judge is a call of the reusable workflow of WARRANT by the tag (06 §8):
// the tag in `uses` and the input `warrant` (indent 6, the block `with:`) are one
// version. Comment lines are dropped before the checks.
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

// The list of paths is the whole match of the profile (design D-5, I-7): a path
// dropped from the profile or added to it changes this test in the same Change.
const humanAcceptancePaths = [
  ".warrant/warrant.json",
  ".warrant/warrant.lock.json",
  ".warrant/local/**",
  ".warrant/waivers/**",
  ".claude/**",
  "**/AGENTS.md",
  ".github/workflows/**",
  "package.json",
  "package-lock.json",
  "**/tsconfig*.json",
];

describe("pin: human acceptance", () => {
  const profile = JSON.parse(read(".warrant/local/profiles/human-acceptance.json")) as {
    $schema: string;
    id: string;
    match: { paths: string[] };
    gates: Record<string, string[]>;
    approvals: { role: string; at: string }[];
  };

  it("the profile human-acceptance is a warrant://profile/1", () => {
    assert.equal(profile.$schema, "warrant://profile/1");
    assert.equal(profile.id, "human-acceptance");
  });

  it("the merge of its paths needs human-approval and the maintainer", () => {
    assert.ok(profile.gates["VERIFYING->MERGED"]?.includes("human-approval"), "no human-approval on VERIFYING->MERGED");
    assert.ok(
      profile.approvals.some((a) => a.role === "maintainer" && a.at === "VERIFYING->MERGED"),
      "no approval of the maintainer on VERIFYING->MERGED",
    );
  });

  it("its paths are the policy, the rules, the waivers, the agent protection, the judge and the toolchain", () => {
    assert.deepEqual([...profile.match.paths].sort(), [...humanAcceptancePaths].sort());
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
