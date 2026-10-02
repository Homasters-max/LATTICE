// Every rejection rule of apply has a fixture (REQ-AR-011, LG-A02): test/fixtures/rules/<RULE-ID>/ holds a whole
// ledger, a proposal, the expected rejections without their message and, for LG-C03, the commits another writer
// appended after opening (`moved.jsonl`); the fixture gives exactly them. The closed list is the one of REQ-LG-002.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apply, checkTail, openLedger, parseProposal, REJECTION_RULES } from "../../src/ledger/index.ts";
import type { Ledger, Rejection } from "../../src/ledger/index.ts";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";

const rules = fileURLToPath(new URL("../fixtures/rules/", import.meta.url));

/** What is missing or extra between the declared rule IDs and the fixture folders. */
function coverage(declared: readonly string[], folders: readonly string[]): string[] {
  return [
    ...declared.filter((r) => !folders.includes(r)).map((r) => `no fixture folder for ${r}`),
    ...folders.filter((f) => !declared.includes(f)).map((f) => `fixture folder ${f} names no declared rule`),
  ];
}

/** Opens `ledger.jsonl` followed by the files of `more`; a ledger that does not open names the folder. */
function opened(dir: string, name: string, ...more: string[]): Ledger {
  const parts = ["ledger.jsonl", ...more].map((file) => jsonlStore(join(dir, file)).read());
  const result = openLedger({ commits: parts.flatMap((p) => p.commits), torn: parts.at(-1)?.torn ?? null });
  if (!result.ok) throw new Error(`fixture folder ${name}: the ledger does not open: ${result.message}`);
  return result.ledger;
}

/** The rejections a fixture folder gives: reading the proposal, apply, then the check of the tail (REQ-LG-004). */
function rejectionsOf(dir: string, name: string): readonly Rejection[] {
  const ledger = opened(dir, name);
  const after = existsSync(join(dir, "moved.jsonl")) ? opened(dir, name, "moved.jsonl") : ledger;
  const parsed = parseProposal(readFileSync(join(dir, "proposal.json"), "utf8"));
  if (!parsed.ok) return parsed.rejections;
  const applied = apply(ledger, parsed.proposal);
  if (applied.outcome === "rejected") return applied.rejections;
  if (applied.outcome !== "commit") return [];
  const check = checkTail(after, applied.commit);
  return check.outcome === "rejected" ? check.rejections : [];
}

/** Checks one fixture folder; returns what is wrong with it, naming the folder. */
function checkFolder(dir: string, name: string): string[] {
  const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as unknown[];
  if (expected.length === 0) return [`fixture folder ${name}: expected.json holds no rejection`];
  const found = rejectionsOf(dir, name);
  const problems: string[] = [];
  try {
    assert.deepEqual(found.map(({ message: _, ...rest }) => rest), expected);
  } catch {
    problems.push(`fixture folder ${name}: the rejections are not the expected ones`);
  }
  if (!found.every((r) => r.rule === name && r.message !== "")) {
    problems.push(`fixture folder ${name}: a rejection names another rule or has no message`);
  }
  return problems;
}

describe("SCN-AR-017 each rule of apply is triggered by its fixture", () => {
  const folders = readdirSync(rules).sort();

  it("SCN-AR-017 every declared rule has exactly one folder and every folder names a declared rule", () => {
    assert.deepEqual(coverage(REJECTION_RULES, folders), []);
  });

  for (const folder of folders) {
    it(`SCN-AR-017 ${folder}: exactly the expected rejections, each naming ${folder}`, () => {
      assert.deepEqual(checkFolder(join(rules, folder), folder), []);
    });
  }

  it("SCN-AR-017 a declared rule without a folder and a folder of no declared rule are reported", () => {
    assert.deepEqual(coverage(["LG-P01", "LG-X99"], ["LG-P01"]), ["no fixture folder for LG-X99"]);
    assert.deepEqual(coverage(["LG-P01"], ["LG-P01", "LG-Q00"]), ["fixture folder LG-Q00 names no declared rule"]);
  });

  it("SCN-AR-017 a fixture whose ledger does not open, or whose expected.json is empty, fails naming its folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "rules-"));
    try {
      for (const file of ["proposal.json", "ledger.jsonl"]) {
        writeFileSync(join(dir, file), readFileSync(join(rules, "LG-P02", file), "utf8"));
      }
      writeFileSync(join(dir, "expected.json"), "[]\n");
      assert.deepEqual(checkFolder(dir, "LG-P02"), ["fixture folder LG-P02: expected.json holds no rejection"]);
      writeFileSync(join(dir, "expected.json"), readFileSync(join(rules, "LG-P02", "expected.json"), "utf8"));
      writeFileSync(join(dir, "ledger.jsonl"), "not a commit\n");
      assert.throws(() => checkFolder(dir, "LG-P02"), /fixture folder LG-P02: the ledger does not open/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
