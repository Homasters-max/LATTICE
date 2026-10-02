// Every rejection rule of apply has a fixture (REQ-AR-011, LG-A02): test/fixtures/rules/<RULE-ID>/ holds a whole
// ledger, a proposal, the expected rejections without their message and, for LG-C03, the commits another writer
// appended after opening (`moved.jsonl`); the fixture gives exactly them. The closed list is the one of REQ-LG-002.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply, checkTail, openLedger, parseProposal, REJECTION_RULES } from "../../src/ledger/index.ts";
import type { Ledger, Rejection } from "../../src/ledger/index.ts";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";
import { bare, rulesDir } from "../ledger/cases.ts";

/** Opens `ledger.jsonl` followed by the files of `more`, or says why it does not open. */
function opened(dir: string, ...more: string[]): Ledger | string {
  const parts = ["ledger.jsonl", ...more].map((file) => jsonlStore(join(dir, file)).read());
  const result = openLedger({ commits: parts.flatMap((p) => p.commits), torn: parts.at(-1)?.torn ?? null });
  return result.ok ? result.ledger : result.message;
}

/** The rejections a fixture folder gives — reading the proposal, apply, the check of the tail — or why it cannot. */
function rejectionsOf(dir: string): readonly Rejection[] | string {
  const ledger = opened(dir);
  const after = existsSync(join(dir, "moved.jsonl")) ? opened(dir, "moved.jsonl") : ledger;
  if (typeof ledger === "string" || typeof after === "string") return `the ledger does not open`;
  const parsed = parseProposal(readFileSync(join(dir, "proposal.json"), "utf8"));
  if (!parsed.ok) return parsed.rejections;
  const applied = apply(ledger, parsed.proposal);
  if (applied.outcome === "rejected") return applied.rejections;
  if (applied.outcome !== "commit") return [];
  const check = checkTail(after, applied.commit);
  return check.outcome === "rejected" ? check.rejections : [];
}

/** Everything wrong with a rules folder against a declared list, each problem naming its rule ID or folder. */
function checkRules(root: string, declared: readonly string[]): string[] {
  const folders = readdirSync(root).sort();
  const problems = [
    ...declared.filter((r) => !folders.includes(r)).map((r) => `no fixture folder for ${r}`),
    ...folders.filter((f) => !declared.includes(f)).map((f) => `fixture folder ${f} names no declared rule`),
  ];
  for (const name of folders.filter((f) => declared.includes(f))) {
    const dir = join(root, name);
    const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as unknown[];
    if (expected.length === 0) {
      problems.push(`fixture folder ${name}: expected.json holds no rejection`);
      continue;
    }
    const found = rejectionsOf(dir);
    if (typeof found === "string") {
      problems.push(`fixture folder ${name}: ${found}`);
      continue;
    }
    try {
      assert.deepEqual(found.map(bare), expected);
    } catch {
      problems.push(`fixture folder ${name}: the rejections are not the expected ones`);
    }
    if (!found.every((r) => r.rule === name && r.message !== "")) {
      problems.push(`fixture folder ${name}: a rejection names another rule or has no message`);
    }
  }
  return problems;
}

describe("SCN-AR-017 each rule of apply is triggered by its fixture", () => {
  it("SCN-AR-017 on the project: one folder per declared rule, each giving exactly its expected rejections", () => {
    assert.deepEqual(checkRules(rulesDir, REJECTION_RULES), []);
  });

  it("SCN-AR-017 a declared rule without a folder, a folder of no declared rule, an empty expected.json and a ledger that does not open are reported", () => {
    const root = mkdtempSync(join(tmpdir(), "rules-"));
    try {
      cpSync(join(rulesDir, "LG-P02"), join(root, "LG-P02"), { recursive: true });
      assert.deepEqual(checkRules(root, ["LG-P02"]), []);
      assert.deepEqual(checkRules(root, ["LG-P02", "LG-X99"]), ["no fixture folder for LG-X99"]);
      cpSync(join(rulesDir, "LG-P01"), join(root, "LG-Q00"), { recursive: true });
      assert.deepEqual(checkRules(root, ["LG-P02"]), ["fixture folder LG-Q00 names no declared rule"]);
      rmSync(join(root, "LG-Q00"), { recursive: true });
      writeFileSync(join(root, "LG-P02", "expected.json"), "[]\n");
      assert.deepEqual(checkRules(root, ["LG-P02"]), ["fixture folder LG-P02: expected.json holds no rejection"]);
      cpSync(join(rulesDir, "LG-P02", "expected.json"), join(root, "LG-P02", "expected.json"));
      writeFileSync(join(root, "LG-P02", "ledger.jsonl"), "not a commit\n");
      assert.deepEqual(checkRules(root, ["LG-P02"]), ["fixture folder LG-P02: the ledger does not open"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
