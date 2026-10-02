// Referrers (REQ-PJ-002, OM-R05): the exact edges of the reference ledger `typed` — entities and events, pinned and
// floating, a type written with its block, replaced revisions, successors, unresolved types — and of `skeleton`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EXPECTED, commitsOf, skeletonCase, typedCase } from "./ledgers.ts";

describe("projections: referrers", () => {
  it("SCN-PJ-002 pinned and floating references from entities and events", () => {
    const view = typedCase().ledger.view;
    for (const target of ["test/n2", "test/n1", "test/e0", "test/node", "core/type"]) {
      assert.deepEqual(view.referrers(target), EXPECTED[target], target);
    }
    // the role `subject` is found by step 2 and by step 3 (the type declares it): one edge
    assert.equal(view.referrers("test/n1").filter((e) => e.from === "test/e1").length, 1);
    // the block written in the same commit as its type, and sorting before it, has its declared references
    assert.ok(view.referrers("test/n1").some((e) => e.from === "test/n3@1" && e.path === "/body/uses/0"));
    const frozen = view.referrers("test/n2");
    assert.ok(Object.isFrozen(frozen) && frozen.every((e) => Object.isFrozen(e)));
    assert.deepEqual(view.referrers("test/nothing"), []);
  });

  it("SCN-PJ-003 a new revision replaces the edges of the one before", () => {
    const view = typedCase().ledger.view;
    for (const target of ["test/n2", "test/n3"]) {
      const from = view.referrers(target).map((e) => e.from);
      assert.ok(from.includes("test/n1@3"), target);
      assert.ok(!from.includes("test/n1@1") && !from.includes("test/n1@2"), target);
    }
    const successors = view.referrers("test/n1").filter((e) => /^\/body\/supersedes\/\d+$/.test(e.path));
    assert.deepEqual(successors, [{ from: "test/n4@1", path: "/body/supersedes/0", ref: "test/n1@3" }]);
  });

  it("SCN-PJ-004 a record whose type does not resolve keeps its envelope references", () => {
    const view = typedCase().ledger.view;
    assert.deepEqual(view.referrers("test/ghost"), EXPECTED["test/ghost"]);
    const n1 = view.referrers("test/n1").map((e) => e.from);
    for (const from of ["test/n5@1", "test/n6@1", "test/n7@1"]) assert.ok(!n1.includes(from), from);
    assert.deepEqual(view.referrers("test/loop-a"), EXPECTED["test/loop-a"]);

    const skeleton = skeletonCase();
    const sview = skeleton.ledger.view;
    const ids = commitsOf(skeleton).flatMap((c) => c.records.map((r) => r.id));
    const edges = [...new Set(ids)].flatMap((id) => sview.referrers(id));
    for (const row of sview.entities().filter((r) => r.type !== "lattice/document@1")) {
      assert.deepEqual(sview.referrers(row.id), [], row.id);
    }
    const parsed = JSON.parse(skeleton.index) as { referrers: Record<string, { path: string }[]> };
    for (const list of Object.values(parsed.referrers)) for (const e of list) assert.equal(e.path, "/type");
    assert.deepEqual(edges, []);
    assert.deepEqual(sview.referrers("lattice/document"), [
      { from: "lattice/fixture@1", path: "/type", ref: "lattice/document@1" },
    ]);
  });
});
