// The namespace policy (REQ-CT-001).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actLogins, policyOf } from "../../src/trust/index.ts";

describe("SCN-CT-001 the policy of the project namespace", () => {
  const slk04 = { owner: "Homasters-max", writers: [{ login: "Homasters-max" }, { kind: "agent" }], owner_acts: [] };

  it("SCN-CT-001 the policy of SL-K04 is a policy; only the writer by name can act", () => {
    const p = policyOf(slk04);
    assert.ok(p.ok);
    assert.deepEqual(actLogins(p.policy), ["Homasters-max"]);
  });

  it("SCN-CT-001 deviations are refused at the first path in the order of REQ-CT-001", () => {
    const cases: [unknown, string][] = [
      [{ owner: "Homasters-max", writers: [{ login: "a", kind: "agent" }], owner_acts: [] }, "/writers/0"],
      [{ owner: "x y", writers: [], owner_acts: [] }, "/owner"],
      [{ owner: "Homasters-max", writers: [], owner_acts: [], extra: 1 }, "/extra"],
      [[], ""],
      [{ writers: [{ x: 1 }], zz: 1 }, "/owner"],
      [{ owner: "Homasters-max", writers: [], owner_acts: ["a", "a"] }, "/owner_acts/1"],
    ];
    for (const [body, path] of cases) assert.deepEqual(policyOf(body), { ok: false, path }, JSON.stringify(body));
  });
});
