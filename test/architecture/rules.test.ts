// Every rejection rule of apply has a fixture (REQ-AR-011, LG-A02): test/fixtures/rules/<RULE-ID>/ holds a whole
// ledger, a proposal and the expected rejections without their message; the fixture gives exactly them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apply, openLedger, parseProposal, REJECTION_RULES } from "../../src/ledger/index.ts";
import type { Rejection } from "../../src/ledger/index.ts";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";

const rules = fileURLToPath(new URL("../fixtures/rules/", import.meta.url));

/** What is missing or extra between the declared rule IDs and the fixture folders. */
function coverage(declared: readonly string[], folders: readonly string[]): string[] {
  return [
    ...declared.filter((r) => !folders.includes(r)).map((r) => `no fixture folder for ${r}`),
    ...folders.filter((f) => !declared.includes(f)).map((f) => `fixture folder ${f} names no declared rule`),
  ];
}

function rejectionsOf(folder: string): readonly Rejection[] {
  const opened = openLedger(jsonlStore(join(rules, folder, "ledger.jsonl")).read());
  if (!opened.ok) throw new Error(`${folder}: ${opened.message}`);
  const parsed = parseProposal(readFileSync(join(rules, folder, "proposal.json"), "utf8"));
  if (!parsed.ok) return parsed.rejections;
  const applied = apply(opened.ledger, parsed.proposal);
  return applied.outcome === "rejected" ? applied.rejections : [];
}

describe("SCN-AR-017 each rule of apply is triggered by its fixture", () => {
  const folders = readdirSync(rules).sort();

  it("SCN-AR-017 the declared list is LG-C07, LG-P01, LG-P02 and every rule has exactly one folder", () => {
    assert.deepEqual([...REJECTION_RULES], ["LG-C07", "LG-P01", "LG-P02"]);
    assert.deepEqual(coverage(REJECTION_RULES, folders), []);
  });

  for (const folder of readdirSync(rules).sort()) {
    it(`SCN-AR-017 ${folder}: exactly the expected rejections, each naming ${folder}`, () => {
      const found = rejectionsOf(folder);
      const expected = JSON.parse(readFileSync(join(rules, folder, "expected.json"), "utf8")) as unknown[];
      assert.deepEqual(found.map(({ message: _, ...rest }) => rest), expected);
      assert.ok(found.length > 0 && found.every((r) => r.rule === folder && r.message !== ""));
    });
  }

  it("SCN-AR-017 a declared rule without a folder and a folder of no declared rule are reported", () => {
    assert.deepEqual(coverage(["LG-P01", "LG-X99"], ["LG-P01"]), ["no fixture folder for LG-X99"]);
    assert.deepEqual(coverage(["LG-P01"], ["LG-P01", "LG-Q00"]), ["fixture folder LG-Q00 names no declared rule"]);
  });
});
