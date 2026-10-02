// Input outside the document form is refused with the line of the first deviation (REQ-CD-001 … REQ-CD-007).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importDocument } from "../../src/codec/index.ts";
import { fixture, NS, session } from "./roundtrip.ts";

/** The line a refused import names; fails when the import is accepted. */
function refusedAt(text: string, file: string): number {
  const r = importDocument(text, file, NS, session());
  assert.ok(!r.ok, "the import was accepted");
  return r.line;
}

/** The fixture with its 1-based line `n` replaced by `by` (several lines when `by` is a list, none when empty). */
function replaced(name: string, n: number, by: string | string[]): string {
  const lines = fixture(name).split("\n");
  lines.splice(n - 1, 1, ...(typeof by === "string" ? [by] : by));
  return lines.join("\n");
}

const lastLine = (text: string): number => text.split("\n").length - 1;

describe("SCN-CD-001 input outside the document form is refused", () => {
  const text = fixture("sections");
  it("SCN-CD-001 the layout: no title, two empty lines, a deeper heading, a paragraph without an ID", () => {
    assert.equal(refusedAt(text.split("\n").slice(2).join("\n"), "sections.md"), 1);
    assert.equal(refusedAt(replaced("sections", 5, ["", "## Purpose"]), "sections.md"), 5);
    assert.equal(refusedAt(replaced("sections", 5, "### Deeper"), "sections.md"), 5);
    assert.equal(refusedAt(replaced("sections", 5, "Free text without an ID."), "sections.md"), 5);
  });

  it("SCN-CD-001 the lines: no final line feed, a carriage return, a byte order mark, not NFC", () => {
    assert.equal(refusedAt(text.slice(0, -1), "sections.md"), lastLine(text));
    assert.equal(refusedAt(replaced("sections", 3, text.split("\n")[2] + "\r"), "sections.md"), 3);
    assert.equal(refusedAt("\uFEFF" + text, "sections.md"), 0);
    assert.equal(refusedAt(replaced("sections", 3, "FX-Z01. Caf" + "e\u0301."), "sections.md"), 3);
  });

  it("SCN-CD-001 the file name", () => {
    assert.equal(refusedAt(text, "notes .md"), 0);
  });

  it("SCN-CD-001 a file without lines is refused at line 1; a title alone is a document without items", () => {
    assert.equal(refusedAt("", "empty.md"), 1);
    const r = importDocument("# Only a title\n", "only.md", NS, session());
    assert.ok(r.ok);
  });
});

describe("SCN-CD-002 a line directly after a paragraph is refused", () => {
  it("SCN-CD-002 a table line or another paragraph right after the last line of FX-R02", () => {
    const text = fixture("paragraphs");
    assert.equal(refusedAt(text + "| x |\n", "paragraphs.md"), 9);
    assert.equal(refusedAt(text + "FX-R03. Another rule.\n", "paragraphs.md"), 9);
  });
});

describe("SCN-CD-004 a table or a list without IDs needs a lead block ending with ':'", () => {
  it("SCN-CD-004 a list after a field, a table after a lead ending with '.', an empty item", () => {
    const lines = fixture("fields").split("\n");
    assert.equal(refusedAt([...lines.slice(0, 8), ...lines.slice(10)].join("\n"), "fields.md"), 9);
    assert.equal(refusedAt(replaced("fields", 3, "FX-Z01. Terms and their rules."), "fields.md"), 5);
    assert.equal(refusedAt(replaced("fields", 11, "- "), "fields.md"), 11);
  });
});

describe("SCN-CD-005 a fence must open with a language and an ID and close", () => {
  it("SCN-CD-005 a fence without its closing line, an opening line without an ID", () => {
    const text = fixture("examples");
    assert.equal(refusedAt(text.split("\n").slice(0, -2).join("\n") + "\n", "examples.md"), 17);
    assert.equal(refusedAt(replaced("examples", 13, "```text"), "examples.md"), 13);
  });
});

describe("SCN-CD-006 a malformed range is refused", () => {
  for (const range of ["FX-B03…B01", "FX-B01…C03", "FX-B001…B999", "FX-B01…GX-B03"]) {
    it(`SCN-CD-006 ${range} in place of FX-B01…B03`, () => {
      const text = fixture("references").replace("FX-B01…B03", range);
      assert.equal(refusedAt(text, "references.md"), 3);
    });
  }
});

describe("SCN-CD-007 a repeated heading slug is refused", () => {
  it("SCN-CD-007 the last line `## Purpose!`", () => {
    const text = fixture("sections");
    assert.equal(refusedAt(replaced("sections", lastLine(text), "## Purpose!"), "sections.md"), lastLine(text));
  });
});

describe("SCN-CD-010 tables, cells and IDs outside the form are refused", () => {
  const cases: [string, string, number][] = [
    ["the repeated ID", replaced("tables", 18, "| FX-R01 | The third rule. |"), 18],
    ["the spaced separator", replaced("tables", 6, "| --- | --- |"), 6],
    ["the compact line", replaced("tables", 7, "|FX-R01|The first rule.|"), 7],
    ["the bare |", replaced("tables", 7, "| FX-R01 | The first|rule. |"), 7],
    ["the short row", replaced("tables", 12, "| FX-T01 | block |"), 12],
    ["the column refs", replaced("tables", 10, "| ID | refs | Meaning |"), 10],
    ["the header repeating slugs with other cells", replaced("tables", 16, "| ID | rule |"), 16],
    ["the table without a row", replaced("tables", 12, []), 12],
    ["the unassigned code point", replaced("tables", 7, "| FX-R01 | The first rule\u0378. |"), 7],
    ["the header without columns", replaced("tables", 5, "| ID |").replace("|---|---|\n| FX-R01 | The first rule. |\n| FX-R02 | A choice: `a` \\| `b`. |", "|---|\n| FX-R01 |\n| FX-R02 |"), 5],
  ];
  for (const [what, text, line] of cases) {
    it(`SCN-CD-010 ${what} at line ${line}`, () => {
      assert.equal(refusedAt(text, "tables.md"), line);
    });
  }

  it("SCN-CD-010 an ID equal to the stem of the file name", () => {
    assert.equal(refusedAt(fixture("tables"), "fx-r03.md"), 18);
  });
});
