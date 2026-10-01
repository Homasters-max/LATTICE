// export (REQ-CL-005).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIXTURE, initialised, onlyProposal } from "./project.ts";
import type { Project } from "./project.ts";

const fixture = readFileSync(FIXTURE, "utf8");
type Json = Record<string, unknown>;

function applied(p: Project): void {
  assert.equal(p.lattice("import-md", "fixture.md").code, 0);
  const r = p.lattice("apply", onlyProposal(p));
  assert.equal(r.code, 0, r.err.join("\n"));
}

/** Applies a proposal of the session event of a fresh import and the given entity intents. */
function applyEntities(p: Project, entities: readonly Json[]): number {
  assert.equal(p.lattice("import-md", "fixture.md").code, 0);
  const path = onlyProposal(p);
  const value = JSON.parse(p.file(path)) as { intents: Json[] };
  const session = value.intents.find((x) => x.kind === "event") as Json;
  value.intents = [...entities.map((e) => ({ kind: "entity", by: session.id, ...e })), session];
  p.write(path, JSON.stringify(value));
  return p.lattice("apply", path).code;
}

describe("SCN-CL-009 export follows the latest revision of a row", () => {
  it("SCN-CL-009 the changed row is exported, the rest as imported", () => {
    const p = initialised();
    try {
      applied(p);
      const changed = "The second rule, changed in a later commit.";
      const code = applyEntities(p, [
        { id: "lattice/fx-a02", type: "lattice/table.rule@1", base: 1, body: { Rule: changed } },
      ]);
      assert.equal(code, 0);
      const r = p.lattice("export", "--out", "out");
      assert.equal(r.code, 0, r.err.join("\n"));
      assert.deepEqual(r.out, ["out/fixture.md"]);
      assert.equal(
        p.file("out/fixture.md"),
        fixture.replace("The second synthetic rule names FX-A01 in its text.", changed),
      );
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-009 a document that breaks the form is refused before anything is written", () => {
    const cases: readonly Json[] = [
      { body: { file: "../escape.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01" }] } },
      { body: { file: "fixture.md", columns: [" Rule"], rows: [{ $ref: "lattice/fx-a01" }] } },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01" }, { $ref: "lattice/fx-a01" }] } },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/plain" }] }, plain: true },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01" }] }, cell: "a | b" },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01" }] }, cell: " lead" },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [] } },
      { body: { file: "fixture.md", columns: ["Rule", "Rule"], rows: [{ $ref: "lattice/fx-a01" }] } },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01@1" }] } },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/missing" }] } },
      { body: { file: "fixture.md", columns: ["Other"], rows: [{ $ref: "lattice/fx-a01" }] } },
      { body: { file: "fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01" }], extra: 1 } },
    ];
    for (const c of cases) {
      const p = initialised();
      try {
        applied(p);
        const { body, plain, cell } = c as { body: Json; plain?: boolean; cell?: string };
        const extra: Json[] = [];
        if (plain === true) extra.push({ id: "lattice/plain", type: "lattice/table.rule@1", base: 0, body: { Rule: "x" } });
        if (cell !== undefined) extra.push({ id: "lattice/fx-a01", type: "lattice/table.rule@1", base: 1, body: { Rule: cell } });
        const doc = { id: "lattice/fixture", type: "lattice/document@1", base: 1, body };
        assert.equal(applyEntities(p, [doc, ...extra]), 0);
        const r = p.lattice("export", "--out", "out");
        assert.equal(r.code, 2, JSON.stringify(c));
        assert.match(r.err.join("\n"), /lattice\/fixture/, "the refusal names the document");
        assert.equal(p.exists("out"), false, JSON.stringify(c));
      } finally {
        p.dispose();
      }
    }
  });

  it("SCN-CL-009 a ledger without documents exports nothing and still creates the folder", () => {
    const p = initialised();
    try {
      const r = p.lattice("export", "--out", "out");
      assert.equal(r.code, 0);
      assert.deepEqual(r.out, []);
      assert.ok(p.exists("out"));
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-009 two documents naming one file in different case are refused", () => {
    const p = initialised();
    try {
      applied(p);
      const body = { file: "Fixture.md", columns: ["Rule"], rows: [{ $ref: "lattice/fx-a01" }] };
      assert.equal(applyEntities(p, [{ id: "lattice/other", type: "lattice/document@1", base: 0, body }]), 0);
      assert.equal(p.lattice("export", "--out", "out").code, 2);
      assert.equal(p.exists("out"), false);
    } finally {
      p.dispose();
    }
  });
});
