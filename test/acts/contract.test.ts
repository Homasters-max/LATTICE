// The contract of the acts port over its four adapters (REQ-AC-001, ST-T01).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Act, Acts } from "../../src/ledger/ports/acts.ts";
import { initActs } from "../../src/adapters/acts-init/index.ts";
import { fixtureActs } from "../../src/adapters/acts-fixture/index.ts";
import { recordedActs } from "../../src/adapters/acts-recorded/index.ts";
import { githubActs } from "../../src/adapters/acts-github/index.ts";
import { H, J, K, OWNER, recorded, REPO } from "./cases.ts";

const act = (names: string[], ref: string): Act => ({ login: OWNER, names, ref });
const onH = act([H], "a-h");
const onK = act([K], "a-k");
const onId = act(["lattice/fx-a01"], "a-id");

const issue = (body: string, ref: string) => ({
  user: { login: OWNER },
  issue_url: `https://api.github.com/repos/${REPO}/issues/7`,
  html_url: ref,
  body,
});

/** Each adapter set up on the same case: acts of the owner naming H, naming K, and naming lattice/fx-a01. */
const adapters: [string, () => Acts][] = [
  ["init", () => initActs(OWNER)],
  ["fixture", () => fixtureActs([onH, onK, onId])],
  [
    "recorded",
    () =>
      recordedActs([
        JSON.stringify({ seq: 1, proposal: H, acts: [onH, onId] }),
        JSON.stringify({ seq: 2, proposal: K, acts: [onK] }),
      ]),
  ],
  [
    "github",
    () =>
      githubActs({
        repo: REPO,
        pr: 7,
        logins: [OWNER],
        transport: recorded({ comments: [[issue(`act ${H}`, "a-h"), issue(`act ${K}`, "a-k"), issue("ok lattice/fx-a01", "a-id")]], reviews: [[]] }),
      }),
  ],
];

const nonEmpty = (v: unknown): boolean => typeof v === "string" && v !== "";
const isHash = (name: string): boolean => !name.includes("/");

function deeplyFrozen(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return true;
  return Object.isFrozen(v) && Object.values(v).every(deeplyFrozen);
}

describe("SCN-AC-001 every adapter keeps the contract", () => {
  for (const [name, make] of adapters) {
    it(`SCN-AC-001 the ${name} adapter answers frozen acts of the form, stable, never only another hash`, () => {
      const acts = make();
      for (const h of [H, K, J]) {
        const one = acts.actsOn(h);
        const two = acts.actsOn(h);
        assert.ok(deeplyFrozen(one), `${name} ${h}: frozen`);
        assert.deepEqual(one, two, `${name} ${h}: stable`);
        for (const a of one) {
          assert.deepEqual(Object.keys(a).sort(), ["login", "names", "ref"]);
          assert.ok(nonEmpty(a.login) && nonEmpty(a.ref) && a.names.length > 0 && a.names.every(nonEmpty));
          assert.ok(!a.names.every((n) => isHash(n) && n !== h), `${name} ${h}: an act naming only another hash`);
        }
      }
      assert.ok(acts.actsOn(H).some((a) => a.names.includes(H)), `${name}: an act naming H`);
    });
  }
});
