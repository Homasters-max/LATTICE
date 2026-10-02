// The current value of a fact key and the live revision (REQ-TR-002).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentFacts, liveRevision } from "../../src/trust/index.ts";

const live = (body: unknown) => ({ type: "std/live@1", body });

const first = [
  live({ of: { subject: "lattice/setup@1" }, key: { id: "lattice/setup" }, value: 1 }),
  live({ of: { subject: "lattice/solve@3" }, key: { id: "lattice/solve" }, value: 3 }),
  live({ of: { subject: "lattice/setup@2" }, key: { id: "lattice/setup" }, value: 2 }),
  { type: "std/other@1", body: { of: {}, key: { id: "lattice/setup" }, value: 9 } },
];

describe("SCN-TR-002 the latest fact of a key wins and a cancellation removes it", () => {
  it("SCN-TR-002 the live revisions of setup, solve and an unknown id", () => {
    assert.equal(liveRevision(first, "lattice/setup"), 2);
    assert.equal(liveRevision(first, "lattice/solve"), 3);
    assert.equal(liveRevision(first, "lattice/none"), undefined);
  });

  it("SCN-TR-002 a cancellation leaves no live revision", () => {
    const revoked = live({ of: { subject: "lattice/setup@2" }, key: { id: "lattice/setup" }, revoked: true });
    assert.equal(liveRevision([...first, revoked], "lattice/setup"), undefined);
  });

  it("SCN-TR-002 bodies that are not fact bodies are skipped; a value that is no revision gives none", () => {
    const both = live({ of: { subject: "lattice/setup@3" }, key: { id: "lattice/setup" }, value: 3, revoked: true });
    const falseRevoked = live({ of: { subject: "lattice/setup@3" }, key: { id: "lattice/setup" }, revoked: false });
    const text = live({ of: { subject: "lattice/setup@3" }, key: { id: "lattice/setup" }, value: "3" });
    assert.equal(liveRevision([...first, both], "lattice/setup"), 2);
    assert.equal(liveRevision([...first, falseRevoked], "lattice/setup"), 2);
    assert.equal(liveRevision([...first, text], "lattice/setup"), undefined);
  });

  it("SCN-TR-002 currentFacts of the three live bodies is a frozen map of two keys", () => {
    const facts = currentFacts(first.slice(0, 3).map((e) => e.body));
    assert.ok(Object.isFrozen(facts));
    assert.deepEqual([...facts.entries()], [
      ['{"id":"lattice/setup"}', 2],
      ['{"id":"lattice/solve"}', 3],
    ]);
  });
});
