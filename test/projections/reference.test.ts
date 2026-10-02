// The reference ledgers kept in git (LG-J02, REQ-PJ-005): every folder rebuilds to its `index.json` byte for byte — on
// every operating system CI runs this file on — and the parsed index holds what the view answers.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:process";
import { serialize } from "../../src/ledger/projections/view.ts";
import { EXPECTED, FIXTURES, commitsOf, entityIds, readCase, skeletonCase, typeEdges, typedCase } from "./ledgers.ts";

type Index = {
  seq: number;
  latest: Record<string, { rev: number; type: string; hash: string }>;
  referrers: Record<string, unknown[]>;
};

describe("projections: reference ledgers", () => {
  it(`SCN-PJ-008 a reference ledger rebuilds to its index (${platform})`, () => {
    const folders = readdirSync(FIXTURES).sort();
    assert.ok(folders.includes("skeleton") && folders.includes("typed"));
    for (const folder of folders) {
      const c = readCase(join(FIXTURES, folder));
      assert.equal(serialize(c.ledger.view) + "\n", c.index, folder);
    }

    const copy = mkdtempSync(join(tmpdir(), "lattice-pj-"));
    try {
      copyFileSync(join(FIXTURES, "typed", "ledger.jsonl"), join(copy, "ledger.jsonl"));
      assert.throws(() => readCase(copy), (e: Error) => e.message.startsWith(copy) && e.message.includes("index.json"));
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it("SCN-PJ-009 the index holds what the view answers", () => {
    for (const c of [typedCase(), skeletonCase()]) {
      const index = JSON.parse(c.index) as Index;
      const view = c.ledger.view;
      const commits = commitsOf(c);
      assert.equal(index.seq, (commits.at(-1) as { seq: number }).seq);
      assert.deepEqual(Object.keys(index.latest).sort(), [...entityIds(commits)].sort());
      for (const r of view.entities()) assert.deepEqual(index.latest[r.id], { hash: r.hash, rev: r.rev, type: r.type });
      for (const [target, edges] of Object.entries(index.referrers)) {
        assert.ok(edges.length > 0, target);
        assert.deepEqual(edges, view.referrers(target), target);
      }
    }
    const skeleton = skeletonCase();
    assert.deepEqual((JSON.parse(skeleton.index) as Index).referrers, typeEdges(commitsOf(skeleton)));
    const typed = JSON.parse(typedCase().index) as Index;
    assert.equal(typed.seq, 4);
    assert.equal(typed.latest["test/n1"]?.rev, 3);
    for (const [target, edges] of Object.entries(EXPECTED)) assert.deepEqual(typed.referrers[target], edges, target);
    assert.equal(typed.referrers["test/n1"]?.length, 3);
  });
});
