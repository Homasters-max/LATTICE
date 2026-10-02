// import-md (REQ-CL-003).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURE, initialised, onlyProposal, project } from "./project.ts";
import { IMPORT_SESSION, initTexts, session as sessionId } from "../ledger/cases.ts";

const fixture = readFileSync(FIXTURE, "utf8");
const BOM = String.fromCharCode(0xfeff);
const ACUTE = String.fromCharCode(0x301); // a combining mark: "i" + ACUTE is not NFC

type Intent = { kind: string; id: string; type: string; base?: number; by: string; at?: string; body: unknown };

describe("SCN-CL-003 the fixture table becomes a proposal", () => {
  it("SCN-CL-003 one proposal of five intents in canonical order, the ledger stays as init wrote it", () => {
    const p = initialised();
    try {
      const r = p.lattice("import-md", "fixture.md");
      assert.equal(r.code, 0, r.err.join("\n"));
      const path = onlyProposal(p);
      assert.deepEqual(r.out, [path]);
      assert.equal(p.file("store/knowledge.jsonl"), initTexts().map((t) => t + "\n").join(""));
      const text = p.file(path);
      assert.ok(text.endsWith("}\n") && !text.slice(0, -1).includes("\n"), "canonical JSON and one line feed");
      const { intents } = JSON.parse(text) as { intents: Intent[] };
      const session = sessionId(IMPORT_SESSION);
      assert.deepEqual(
        intents.map((x) => [x.kind, x.id, x.type]),
        [
          ["entity", "lattice/fixture", "lattice/document@1"],
          ["entity", "lattice/fx-a01", "lattice/table.rule@1"],
          ["entity", "lattice/fx-a02", "lattice/table.rule@1"],
          ["entity", "lattice/fx-a03", "lattice/table.rule@1"],
          ["event", session, "core/session@1"],
        ],
      );
      assert.ok(intents.every((x) => x.by === session));
      assert.ok(intents.filter((x) => x.kind === "entity").every((x) => x.base === 0));
      assert.deepEqual(intents[1]?.body, { Rule: "The first synthetic rule of the walking skeleton." });
      assert.deepEqual(intents[0]?.body, {
        file: "fixture.md",
        columns: ["Rule"],
        rows: [{ $ref: "lattice/fx-a01" }, { $ref: "lattice/fx-a02" }, { $ref: "lattice/fx-a03" }],
      });
      assert.deepEqual(intents[4]?.body, { of: {}, participant: "lattice", kind: "machine", purpose: "import" });
      assert.equal(intents[4]?.at, "1970-01-01T00:00:00.000Z");
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-003 an existing proposal file of the same name is refused with code 2", () => {
    // store init takes the first four ULIDs; every import after it gets the same one
    let n = 0;
    const p = initialised({ ids: { ulid: () => String(Math.min(++n, 5)).padStart(26, "0") } });
    try {
      assert.equal(p.lattice("import-md", "fixture.md").code, 0);
      const before = p.file(onlyProposal(p));
      assert.equal(p.lattice("import-md", "fixture.md").code, 2);
      assert.equal(p.file(onlyProposal(p)), before);
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-004 input outside the skeleton form is refused", () => {
  const lines = fixture.split("\n");
  const wide = (text: string, header: string): string =>
    text.replace("| ID | Rule |", header).replace("| --- | --- |", "| --- | --- | --- |");
  const cases: { readonly name: string; readonly text: string; readonly line: number }[] = [
    { name: "compact.md", text: [lines[0], lines[1], "|FX-A01|text|", ...lines.slice(3)].join("\n"), line: 3 },
    { name: "paragraph.md", text: fixture + "\nA paragraph after the table.\n", line: 6 },
    { name: "duplicate.md", text: fixture + "| FX-A01 | again |\n", line: 6 },
    { name: "unterminated.md", text: fixture.slice(0, -1), line: 5 },
    { name: "twice.md", text: wide(fixture, "| ID | Rule | Rule |"), line: 1 },
    { name: "no-row.md", text: lines.slice(0, 2).join("\n") + "\n", line: 3 },
    { name: "fx-a01.md", text: fixture, line: 3 },
    { name: "rule-case.md", text: wide(fixture, "| ID | Rule | rule |"), line: 1 },
    { name: "dollar.md", text: fixture.replace("| ID | Rule |", "| ID | $ref |"), line: 1 },
    { name: "carriage.md", text: fixture.replace("\n", "\r\n"), line: 1 },
    { name: "nfd.md", text: fixture.replace("first", "fi" + ACUTE + "rst"), line: 3 },
    { name: "bom.md", text: BOM + fixture, line: 0 },
    { name: "Bad_Name.md", text: fixture, line: 0 },
    { name: "Setup.md", text: fixture, line: 0 },
    { name: "namespace.md", text: fixture, line: 0 },
  ];

  for (const c of cases) {
    it(`SCN-CL-004 ${c.name} is refused with code 1 at line ${c.line}`, () => {
      const p = initialised();
      try {
        p.write(c.name, c.text);
        const r = p.lattice("import-md", c.name);
        assert.equal(r.code, 1, r.err.join("\n"));
        assert.ok(r.err.join("\n").startsWith(`${c.name}:${c.line}: `), r.err.join("\n"));
        assert.deepEqual(p.proposals(), []);
      } finally {
        p.dispose();
      }
    });
  }

  it("SCN-CL-004 invalid UTF-8 is refused with code 1 at line 0", () => {
    const p = initialised();
    try {
      writeFileSync(join(p.dir, "bytes.md"), Buffer.from([0x7c, 0x20, 0xff, 0x0a]));
      const r = p.lattice("import-md", "bytes.md");
      assert.equal(r.code, 1);
      assert.ok(r.err.join("\n").startsWith("bytes.md:0: "));
      assert.match(r.err.join("\n"), /UTF-8/);
      writeFileSync(join(p.dir, "Bad_Name.md"), Buffer.from([0xff]));
      assert.match(p.lattice("import-md", "Bad_Name.md").err.join("\n"), /^Bad_Name\.md:0: the file name/);
      assert.deepEqual(p.proposals(), []);
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-004 the fixture in a folder without a store is refused with code 2", () => {
    const p = project();
    try {
      p.write("fixture.md", fixture);
      assert.equal(p.lattice("import-md", "fixture.md").code, 2);
      assert.equal(p.exists("store"), false);
    } finally {
      p.dispose();
    }
  });
});
