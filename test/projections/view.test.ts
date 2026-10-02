// The read view of an opened ledger (REQ-PJ-001): latest revision, every revision, entities, frozen records, and a
// ledger with repeated and falling revisions read in ledger order (SCN-PJ-011, review 3 F-2).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EntityRecord } from "../../src/ledger/index.ts";
import { isEntityRecord } from "../../src/ledger/records.ts";
import { commitsOf, typedCase } from "./ledgers.ts";

const deeplyFrozen = (v: unknown): boolean =>
  typeof v !== "object" || v === null || (Object.isFrozen(v) && Object.values(v).every(deeplyFrozen));

/** The entity records of `id` in ledger order, with the `seq` of their commit. */
function recordsOf(id: string): { seq: number; record: EntityRecord }[] {
  return commitsOf(typedCase()).flatMap((c) =>
    c.records.filter(isEntityRecord).flatMap((record) => (record.id === id ? [{ seq: c.seq, record }] : [])),
  );
}

describe("projections: the read view", () => {
  it("SCN-PJ-001 latest revision and every revision of an entity", () => {
    const { ledger } = typedCase();
    const view = ledger.view;
    assert.equal(view.seq, 4);
    assert.equal(view.get("test/n1")?.rev, 3);
    assert.deepEqual(view.get("test/n1")?.body, { uses: ["test/n2", "test/n3"], pins: "test/n2@1" });
    assert.equal(view.revision("test/n1", 1)?.rev, 1);
    assert.deepEqual(view.revision("test/n1", 1)?.body, { uses: ["test/n2"] });
    assert.equal(view.revision("test/n1", 2)?.rev, 2);
    assert.deepEqual(view.revision("test/n1", 2)?.body, { uses: ["test/n3"] });
    assert.equal(view.revision("test/n1", 4), undefined);
    assert.equal(view.revision("test/absent", 1), undefined);
    assert.equal(view.get("test/absent"), undefined);

    const ids = new Set(commitsOf(typedCase()).flatMap((c) => c.records.filter(isEntityRecord).map((r) => r.id)));
    const entities = view.entities();
    assert.deepEqual(
      entities.map((r) => r.id),
      [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    for (const r of entities) assert.equal(r, view.get(r.id));
    assert.ok(Object.isFrozen(entities));
    for (const r of [...entities, view.revision("test/n1", 1)]) assert.ok(deeplyFrozen(r));
  });

  it("SCN-PJ-011 a repeated or falling revision is read in ledger order", () => {
    const view = typedCase().ledger.view;
    const n8 = recordsOf("test/n8");
    assert.deepEqual(n8.map((x) => [x.seq, x.record.rev]), [[3, 1], [4, 1]]);
    assert.deepEqual(view.get("test/n8")?.body, { uses: ["test/n3"] });
    assert.deepEqual(view.revision("test/n8", 1)?.body, { uses: ["test/n3"] });
    // a lower `rev` after a higher one: `get` is the last in ledger order, not the highest `rev`
    assert.deepEqual(recordsOf("test/n11").map((x) => [x.seq, x.record.rev]), [[3, 2], [4, 1]]);
    assert.equal(view.get("test/n11")?.rev, 1);
    assert.deepEqual(view.revision("test/n11", 2)?.body, { uses: ["test/n2"] });

    assert.ok(!view.referrers("test/n1").some((e) => e.from === "test/n8@1"));
    assert.deepEqual(
      view.referrers("test/n3").filter((e) => e.from === "test/n8@1"),
      [{ from: "test/n8@1", path: "/body/uses/0", ref: "test/n3" }],
    );
    assert.ok(!view.referrers("test/n2").some((e) => e.from === "test/n11@2" || e.from === "test/n11@1"));
    const n2 = view.referrers("test/n2");
    assert.ok(n2.some((e) => e.from === "test/n10@1" && e.path === "/body/uses/0"));
    assert.ok(!n2.some((e) => e.from === "test/n9@1"));
  });
});
