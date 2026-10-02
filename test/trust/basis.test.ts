// The basis table (REQ-TR-001).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { basis } from "../../src/trust/index.ts";

const session = (kind: string, purpose: string, extra: Record<string, unknown> = {}) => ({
  of: {},
  participant: kind === "machine" ? "lattice" : "Homasters-max",
  kind,
  purpose,
  ...extra,
});

describe("SCN-TR-001 every row of the basis table", () => {
  const acted = [
    session("human", "work"),
    session("agent", "work"),
    session("machine", "check"),
    session("machine", "bench"),
    session("machine", "init"),
    session("machine", "work"),
    session("machine", "import"),
    session("machine", "check", { pipeline: "lattice/solve@1" }),
  ];

  it("SCN-TR-001 with an act: asserted, asserted, observed, observed, derived ×3, inferred", () => {
    assert.deepEqual(
      acted.map((s) => basis(s, true)),
      ["asserted", "asserted", "observed", "observed", "derived", "derived", "derived", "inferred"],
    );
  });

  it("SCN-TR-001 without an act every session is inferred", () => {
    for (const s of acted) assert.equal(basis(s, false), "inferred");
  });

  it("SCN-TR-001 a session outside the lists or not an object is inferred, act or not", () => {
    for (const s of [
      { of: {}, participant: "x", kind: "robot", purpose: "work" },
      { of: {}, participant: "lattice", kind: "machine", purpose: "play" },
      session("human", "play"),
      null,
      [],
    ]) {
      assert.equal(basis(s, true), "inferred");
      assert.equal(basis(s, false), "inferred");
    }
  });
});
