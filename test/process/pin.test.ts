// Pin invariant of the WARRANT judge (Change pin-v0-8-1, design D-3): the CI tag
// equals the CLI version that wrote the lock, and the project rules moved out of
// dev/ are delivered to the agent through AGENTS.md. No spec scenarios
// (skip_specs), so no SCN tokens.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

describe("pin: CI judge and lock", () => {
  it("the single CLI tag in warrant.yml equals v + kernel of the lock", () => {
    const workflow = read(".github/workflows/warrant.yml");
    const tags = [...workflow.matchAll(/Homasters-max\/SRA#v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
    const lock = JSON.parse(read(".warrant/warrant.lock.json")) as { kernel: string };
    assert.deepEqual(tags, [lock.kernel]);
  });
});

describe("pin: project rules", () => {
  for (const id of ["maintainer-acts", "session-start"]) {
    it(`rule ${id} is a warrant://rule/1 for every path, its text is in AGENTS.md`, () => {
      const rule = JSON.parse(read(`.warrant/local/rules/${id}.json`)) as Record<string, unknown>;
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
