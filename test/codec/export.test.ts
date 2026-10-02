// Export refuses a document whose rendering would not read back into the same blocks (REQ-CD-008, design D-7).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportDocuments } from "../../src/codec/index.ts";
import { entities, fixture, imported, ledgerOf, NS, revision } from "./roundtrip.ts";

const L = (local: string): string => `lattice/${local}`;
const first = imported(fixture("sections"), "sections.md");
const blocks = entities(first);

function body(id: string): Record<string, unknown> {
  return { ...(blocks.get(L(id))?.body as Record<string, unknown>) };
}

/** The export after the first commit and a second one holding the given entity intents. */
function exportAfter(changes: { id: string; type: string; body: unknown; base?: number }[]) {
  return exportDocuments(ledgerOf(first, revision(changes)).view, NS);
}

describe("SCN-CD-009 a document that would not read back is refused", () => {
  const cases: [string, { id: string; type: string; body: unknown; base?: number }[]][] = [
    ["a paragraph text with a line `## x`", [{ id: L("fx-z02"), type: L("paragraph@1"), body: { ...body("fx-z02"), text: "a\n## x" } }]],
    ["a row cell ending with a space", [{ id: L("fx-r01"), type: L("table.rule@2"), body: { ...body("fx-r01"), Rule: "The first rule. " } }]],
    ["refs that disagree with the text", [{ id: L("fx-r02"), type: L("table.rule@2"), body: { ...body("fx-r02"), refs: [] } }]],
    [
      "a document item naming no entity",
      [{ id: L("sections"), type: L("document@2"), body: { ...body("sections"), items: [L("fx-z99")] } }],
    ],
  ];
  for (const [what, changes] of cases) {
    it(`SCN-CD-009 ${what}: refused naming lattice/sections`, () => {
      const out = exportAfter(changes);
      assert.ok(!out.ok, "the export was accepted");
      assert.match(out.message, /^lattice\/sections: /);
    });
  }

  it("SCN-CD-009 a second document naming the file Sections.md: refused naming it", () => {
    const out = exportAfter([{ id: L("other"), type: L("document@2"), body: { ...body("sections"), file: "Sections.md" }, base: 0 }]);
    assert.ok(!out.ok, "the export was accepted");
    assert.match(out.message, /^lattice\/other: /);
  });

  it("SCN-CD-009 an unchanged ledger exports the fixture", () => {
    const out = exportDocuments(ledgerOf(first).view, NS);
    assert.ok(out.ok, out.ok ? "" : out.message);
    assert.equal(out.files[0]?.text, fixture("sections"));
  });
});
