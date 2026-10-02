// The result of apply does not depend on the order of intents (REQ-LG-005, LG-C07, design D-7): every case is read
// and applied as written and in every permutation (or, above 7 intents, the reverse, every rotation and 50 seeded
// shuffles); the outcome, the commit text, the `existing` seq, the check of the tail and the rejections — without
// `message` and without the `/intents/<i>` prefix of their path — must be the same.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonical } from "../../src/kernel/index.ts";
import { checkTail } from "../../src/ledger/index.ts";
import type { Ledger, Rejection } from "../../src/ledger/index.ts";
import {
  applyText,
  bare,
  committed,
  duplicateOfFirstRow,
  editing,
  fixtureIntents,
  ledgerOf,
  ledgerTexts,
  revisedIntents,
  ruleText,
  rulesDir,
  sessionOnly,
  textOf,
} from "./cases.ts";

type Case = { readonly name: string; readonly text: string; readonly ledger: Ledger; readonly after: Ledger };

function cases(): Case[] {
  const all: Case[] = [];
  for (const folder of readdirSync(rulesDir).sort()) {
    const dir = join(rulesDir, folder);
    const base = ledgerTexts(join(dir, "ledger.jsonl"));
    all.push({
      name: `rule fixture ${folder}`,
      text: readFileSync(join(dir, "proposal.json"), "utf8"),
      ledger: ledgerOf(base),
      after: ledgerOf([...base, ...ledgerTexts(join(dir, "moved.jsonl"))]),
    });
  }
  const on = (name: string, texts: readonly string[], intents: readonly unknown[]): Case => {
    const ledger = ledgerOf(texts);
    return { name, text: textOf(intents), ledger, after: ledger };
  };
  const first = committed([], fixtureIntents(1));
  const copy = duplicateOfFirstRow;
  all.push(
    on("the fixture proposal on an empty ledger", [], fixtureIntents(1)),
    on("the fixture proposal on its own commit", first, fixtureIntents(1)),
    on("a changed duplicate", [], [...fixtureIntents(), copy("changed")]),
    on("an unchanged duplicate", [], [...fixtureIntents(), copy()]),
    on("two duplicates", [], [...fixtureIntents(), copy("changed"), copy()]),
    on("unchanged entities", first, revisedIntents(2)),
    on("one changed body", first, revisedIntents(2, ruleText("lattice/fx-a02", "c"))),
    on("another type revision", first, revisedIntents(2, editing("lattice/fx-a01", (x) => (x.type = "lattice/table.rule@2")))),
    on("only a session", first, sessionOnly(2)),
  );
  return all;
}

/** Every permutation for at most 7 items; otherwise the reverse, every rotation and 50 shuffles from a fixed seed. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 7) {
    const out: T[][] = [];
    const a = [...items];
    const heap = (k: number): void => {
      if (k <= 1) return void out.push([...a]);
      for (let i = 0; i < k - 1; i++) {
        heap(k - 1);
        const j = k % 2 === 0 ? i : 0;
        [a[j], a[k - 1]] = [a[k - 1] as T, a[j] as T];
      }
      heap(k - 1);
    };
    heap(a.length);
    return out;
  }
  const out: T[][] = [[...items].reverse()];
  for (let r = 1; r < items.length; r++) out.push([...items.slice(r), ...items.slice(0, r)]);
  let seed = 0x5eed;
  const random = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let n = 0; n < 50; n++) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    out.push(a);
  }
  return out;
}

const stripped = (rejections: readonly Rejection[]): string[] =>
  rejections
    .map(bare)
    .map((rest) => {
      const text = canonical({ ...rest, path: String(rest.path).replace(/^\/intents\/\d+/, "") });
      if (!text.ok) throw new Error("rejection: not JSON");
      return text.value;
    })
    .sort();

/** The result of a proposal text, in the terms REQ-LG-005 compares. */
function resultOf(c: Case, text: string): unknown {
  const answer = applyText(c.ledger, text);
  switch (answer.outcome) {
    case "rejected":
      return { outcome: "rejected", rejections: stripped(answer.rejections) };
    case "commit": {
      const check = checkTail(c.after, answer.commit);
      const tail = check.outcome === "rejected" ? { outcome: "rejected", rejections: stripped(check.rejections) } : check;
      return { outcome: "commit", text: answer.text, tail };
    }
    default:
      return answer;
  }
}

describe("SCN-LG-006 every permutation of the intents gives the same result", () => {
  for (const c of cases()) {
    it(`SCN-LG-006 ${c.name}`, () => {
      const written = resultOf(c, c.text);
      const value = JSON.parse(c.text) as { intents?: unknown };
      const intents = Array.isArray(value.intents) ? (value.intents as unknown[]) : null;
      const texts = intents === null ? [c.text] : permutations(intents).map((p) => JSON.stringify({ ...value, intents: p }));
      assert.ok(texts.length >= 1);
      for (const text of texts) assert.deepEqual(resultOf(c, text), written);
    });
  }

  it("SCN-LG-006 the permutations: all of them up to 7 intents, 1 + n - 1 + 50 above", () => {
    assert.equal(permutations([1, 2, 3, 4]).length, 24);
    assert.equal(new Set(permutations([1, 2, 3, 4]).map((p) => p.join())).size, 24);
    assert.equal(permutations([1, 2, 3, 4, 5, 6, 7, 8]).length, 1 + 7 + 50);
  });
});
