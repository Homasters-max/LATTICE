// Mentions, code spans and ranges of a text (REQ-CD-006, design D-5), unit cases of `references.ts`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mentions } from "../../src/codec/references.ts";

function ids(text: string): readonly string[] {
  const m = mentions(text);
  assert.ok(m.ok, m.ok ? "" : m.message);
  return m.ids;
}

describe("SCN-CD-006 mentions, ranges and code spans", () => {
  it("SCN-CD-006 a mention is bounded by characters outside [A-Za-z0-9-]", () => {
    assert.deepEqual(ids("(DP-C04), DP-C04."), ["DP-C04", "DP-C04"]);
    assert.deepEqual(ids("REQ-CL-003 xDP-C04 DP-C04x DP-C04-1 I-JSON"), []);
    assert.deepEqual(ids("lattice/DP-B01"), ["DP-B01"]);
  });

  it("SCN-CD-006 code spans hide mentions; an unmatched backtick run is literal", () => {
    assert.deepEqual(ids("`DP-B01` and ``a `DP-Z04` b`` and DP-C01"), ["DP-C01"]);
    assert.deepEqual(ids("` DP-C01"), ["DP-C01"]);
    assert.deepEqual(ids("``x` DP-C01 `` DP-C02"), ["DP-C02"]);
  });

  it("SCN-CD-006 ranges in both forms expand with their digits", () => {
    assert.deepEqual(ids("DP-C01…C03"), ["DP-C01", "DP-C02", "DP-C03"]);
    assert.deepEqual(ids("ST-A09…ST-A10"), ["ST-A09", "ST-A10"]);
    assert.deepEqual(ids("GL-01…03"), ["GL-01", "GL-02", "GL-03"]);
    assert.deepEqual(ids("DP-C01… and"), ["DP-C01"]);
  });

  it("SCN-CD-006 malformed ranges are refused at their start", () => {
    for (const text of ["x DP-C05…C01", "x DP-C01…D03", "x DP-C01…C003", "x DP-C001…C999", "x DP-A1B01…DP-A1B03", "x DP-C01…GX-C03"]) {
      const m = mentions(text);
      assert.ok(!m.ok, text);
      assert.equal(m.offset, 2, text);
    }
  });
});
