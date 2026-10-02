// The forms of LG-B06 imported into blocks, and the round trip of every fixture (REQ-CD-002 … REQ-CD-008).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entities, FIXTURES, fixture, imported, roundTrip } from "./roundtrip.ts";

const L = (local: string): string => `lattice/${local}`;

function blocksOf(name: string) {
  return entities(imported(fixture(name), `${name}.md`));
}

describe("SCN-CD-002 paragraphs and prose blocks become paragraph blocks", () => {
  it("SCN-CD-002 rule paragraphs, the second of two lines", () => {
    const e = blocksOf("paragraphs");
    assert.deepEqual(e.get(L("fx-r01")), {
      type: L("paragraph@1"),
      body: { text: "A rule written as a paragraph.", refs: [] },
    });
    assert.equal(e.get(L("fx-r02"))?.body.text, "A rule of two lines,\ncontinued on the next line.");
  });

  it("SCN-CD-002 prose paragraphs before a heading, under it and after a table", () => {
    const e = blocksOf("prose");
    for (const id of ["fx-z01", "fx-z02", "fx-z03"]) assert.equal(e.get(L(id))?.type, L("paragraph@1"));
    assert.equal(e.get(L("fx-z01"))?.body.text, "A prose block before the first heading.");
    assert.equal(e.get(L("fx-z03"))?.body.text, "A note under the table,\nwritten on two lines.");
  });
});

describe("SCN-CD-003 rows under two headers become blocks of two types", () => {
  it("SCN-CD-003 one type per distinct header, the escaped pipe kept", () => {
    const e = blocksOf("tables");
    for (const id of ["fx-r01", "fx-r02", "fx-r03"]) assert.equal(e.get(L(id))?.type, L("table.rule@2"));
    assert.deepEqual(e.get(L("fx-r01"))?.body, { Rule: "The first rule.", refs: [] });
    assert.deepEqual(e.get(L("fx-t01")), {
      type: L("table.term.meaning@2"),
      body: { Term: "block", Meaning: "One statement with an ID.", refs: [] },
    });
    assert.equal(e.get(L("fx-r02"))?.body.Rule, "A choice: `a` \\| `b`.");
  });
});

describe("SCN-CD-004 a table and a list become fields of their lead blocks", () => {
  it("SCN-CD-004 fields in the owners' bodies, never items", () => {
    const e = blocksOf("fields");
    assert.deepEqual(e.get(L("fx-z01"))?.body, {
      text: "Terms and their rules:",
      refs: [L("fx-r01")],
      table: { header: ["Term", "Defined by"], rows: [["block", "FX-R01"]] },
    });
    assert.deepEqual(e.get(L("fx-z02"))?.body.list, ["One statement, one ID.", "Machine formats are JSON (FX-R02)."]);
    assert.deepEqual(e.get(L("fx-r02"))?.body.table, { header: ["In md", "Block"], rows: [["a row", "a block"]] });
    assert.deepEqual(e.get(L("fields"))?.body.items, [L("fx-z01"), L("fx-z02"), L("fields.rules")]);
    assert.deepEqual(e.get(L("fields.rules"))?.body.items, [{ columns: ["Rule"], rows: [L("fx-r01"), L("fx-r02")] }]);
  });
});

describe("SCN-CD-005 a fenced example keeps its bytes", () => {
  it("SCN-CD-005 language and content lines, no references from the content", () => {
    const e = blocksOf("examples");
    assert.deepEqual(e.get(L("fx-z02")), {
      type: L("example@1"),
      body: { language: "json", text: '{ "a": 1,\n\n| not a table\n# not a heading\n  "b": "FX-R01" }\n' },
    });
    assert.deepEqual(e.get(L("fx-z03"))?.body, { language: "text", text: "one line\n" });
    assert.deepEqual(e.get(L("fx-z04"))?.body, { language: "text", text: "" });
  });
});

describe("SCN-CD-006 mentions, ranges and code spans", () => {
  it("SCN-CD-006 refs in order of first mention, without code spans, bounded tokens or the own ID", () => {
    const e = blocksOf("references");
    assert.deepEqual(e.get(L("fx-z01"))?.body.refs, [
      L("fx-a01"),
      L("fx-b01"),
      L("fx-b02"),
      L("fx-b03"),
      L("fx-c01"),
      L("fx-c02"),
    ]);
    assert.deepEqual(e.get(L("fx-r01"))?.body.refs, [L("fx-a02"), L("fx-a01")]);
    assert.deepEqual(e.get(L("fx-z02"))?.body.refs, [L("fx-e01")]);
    assert.match(e.get(L("fx-z01"))?.body.text as string, /`FX-D01`, REQ-FX-001, I-JSON/);
  });
});

describe("SCN-CD-007 sections and the document hold references and labels only", () => {
  it("SCN-CD-007 the document, its sections and their items", () => {
    const p = imported(fixture("sections"), "sections.md");
    const e = entities(p);
    assert.deepEqual(e.get(L("sections")), {
      type: L("document@2"),
      body: {
        file: "sections.md",
        title: "99. Sections",
        items: [L("fx-z01"), L("sections.purpose"), L("sections.rules-and-notes"), L("sections.empty")],
      },
    });
    assert.deepEqual(e.get(L("sections.rules-and-notes")), {
      type: L("section@1"),
      body: {
        heading: "Rules and notes",
        items: [{ columns: ["Rule"], rows: [L("fx-r01"), L("fx-r02")] }, L("fx-z03"), L("fx-z04")],
      },
    });
    assert.deepEqual(e.get(L("sections.empty"))?.body, { heading: "Empty", items: [] });
    const event = p.intents.find((x) => x.kind === "event");
    assert.deepEqual(event?.body, { of: {}, participant: "lattice", kind: "machine", purpose: "import" });
    for (const x of p.intents) {
      assert.equal(x.by, event?.id);
      if (x.kind === "entity") assert.equal(x.base, 0);
    }
  });

  it("SCN-CD-007 a file named Sections.md gives the same ids in lower case", () => {
    const e = entities(imported(fixture("sections"), "Sections.md"));
    assert.equal(e.get(L("sections"))?.body.file, "Sections.md");
    assert.ok(e.has(L("sections.purpose")));
  });
});

describe("SCN-CD-008 every form round-trips on its own fixture", () => {
  for (const name of FIXTURES) {
    it(`SCN-CD-008 ${name}.md comes back byte for byte`, () => {
      const text = fixture(name);
      const out = roundTrip(text, `${name}.md`);
      assert.ok(out.ok, out.ok ? "" : out.message);
      assert.equal(out.files.length, 1);
      assert.equal(out.files[0]?.file, `${name}.md`);
      assert.equal(out.files[0]?.text, text);
    });
  }
});
