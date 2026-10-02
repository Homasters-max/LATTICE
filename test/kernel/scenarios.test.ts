// Kernel scenarios driven by the vectors of test/kernel/vectors.ts: exact refusals or values.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as kernel from "../../src/kernel/index.ts";
import { cases, chainCases, deepCases } from "./vectors.ts";
import type { Case } from "./vectors.ts";

function call(c: Case, args: unknown[]): unknown {
  const fn = kernel[c.fn] as (...a: unknown[]) => unknown;
  return fn(...args);
}

function assertCase(c: Case): void {
  const args = c.args();
  const res = call(c, args) as { ok: boolean; value?: unknown; errors?: unknown };
  if (c.errors !== undefined) {
    assert.deepEqual(res, { ok: false, errors: c.errors });
    return;
  }
  assert.equal(res.ok, true, JSON.stringify(res).slice(0, 300));
  if ("value" in c) assert.deepEqual(res.value, c.value);
  if (c.check !== undefined) c.check(res.value, args);
}

const byScenario = new Map<string, Case[]>();
for (const c of [...cases, ...chainCases, ...deepCases]) {
  const list = byScenario.get(c.scn) ?? [];
  list.push(c);
  byScenario.set(c.scn, list);
}

for (const [scn, list] of byScenario) {
  describe(scn, () => {
    for (const c of list) {
      it(`${scn} ${c.fn}: ${c.name}`, () => assertCase(c));
    }
  });
}
