// The command table and init (REQ-CL-001, REQ-CL-002).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";
import type { Store } from "../../src/ledger/ports/store.ts";
import { initTexts, stdText } from "../ledger/cases.ts";
import { FIXTURE, initialised, onlyProposal, project } from "./project.ts";

describe("SCN-CL-001 an unknown command prints the usage", () => {
  it("SCN-CL-001 no command, an unknown one and export without --out exit 2 and write nothing", () => {
    const p = project();
    try {
      for (const argv of [[], ["frobnicate"]]) {
        const r = p.lattice(...argv);
        assert.equal(r.code, 2);
        const usage = r.err.join("\n");
        for (const name of ["init", "import-md", "apply", "export"]) assert.match(usage, new RegExp(`\\b${name}\\b`));
      }
      assert.equal(p.lattice("export").code, 2);
      assert.equal(p.lattice("apply").code, 2);
      assert.equal(p.lattice("init", "--namespace", "lattice", "--owner", "x", "--extra").code, 2);
      assert.deepEqual(readdirSync(p.dir), []);
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-002 a store is created once", () => {
  it("SCN-CL-002 init writes the configuration, the four init commits and proposals; a second init changes nothing", () => {
    const p = project();
    try {
      const first = p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max");
      assert.equal(first.code, 0, first.err.join("\n"));
      assert.deepEqual(first.out, [1, 2, 3, 4].map((seq) => JSON.stringify({ outcome: "commit", seq })));
      assert.equal(p.file("store/lattice.json"), '{"namespace":"lattice","owner":"Homasters-max"}\n');
      assert.equal(p.file("store/knowledge.jsonl"), initTexts().map((t) => t + "\n").join(""));
      assert.deepEqual(p.proposals(), []);
      assert.ok(p.exists("store/proposals"));
      p.write("store/proposals/kept.json", "{}");
      const before = [p.file("store/lattice.json"), p.file("store/knowledge.jsonl"), p.proposals().join()];
      const second = p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max");
      assert.equal(second.code, 2);
      assert.deepEqual([p.file("store/lattice.json"), p.file("store/knowledge.jsonl"), p.proposals().join()], before);
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-002 a namespace outside the grammar or reserved, a bad login or a missing option creates no store", () => {
    const cases = [
      ["--namespace", "Lattice", "--owner", "Homasters-max"],
      ["--namespace", "std", "--owner", "Homasters-max"],
      ["--namespace", "core", "--owner", "Homasters-max"],
      ["--namespace", "a".repeat(65), "--owner", "Homasters-max"],
      ["--namespace", "lattice", "--owner", "bad login"],
      ["--namespace", "lattice"],
    ];
    for (const args of cases) {
      const p = project();
      try {
        assert.equal(p.lattice("init", ...args).code, 2, args.join(" "));
        assert.equal(p.exists("store"), false, args.join(" "));
      } finally {
        p.dispose();
      }
    }
  });

  it("SCN-CL-002 a command on a folder without a store, or with a changed configuration, is refused", () => {
    const p = project();
    try {
      assert.equal(p.lattice("export", "--out", "out").code, 2);
      assert.equal(p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max").code, 0);
      p.write("store/lattice.json", '{"namespace": "lattice", "owner": "Homasters-max"}\n');
      assert.equal(p.lattice("export", "--out", "out").code, 2);
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-015 a refused std package creates nothing", () => {
  it("SCN-CL-015 one schema character changed: code 2 naming LG-G02, no store/", () => {
    const changed = stdText().replace('"maxLength":128', '"maxLength":129');
    const p = project({ std: changed });
    try {
      const r = p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max");
      assert.equal(r.code, 2);
      assert.match(r.err.join("\n"), /LG-G02/);
      assert.equal(p.exists("store"), false);
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-017 a store that moves during init is refused", () => {
  it("SCN-CL-017 moved on the third append: code 2 naming the store, no commit line, two commits; apply then LG-G04", () => {
    let real: Store | null = null;
    let appends = 0;
    const store: Store = {
      read: () => (real as Store).read(),
      append: (commit, after) => (++appends === 3 ? { ok: false, reason: "moved" } : (real as Store).append(commit, after)),
    };
    const p = project({ store });
    real = jsonlStore(join(p.dir, "store", "knowledge.jsonl"));
    try {
      const r = p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max");
      assert.equal(r.code, 2);
      assert.match(r.err.join("\n"), /knowledge\.jsonl.*tail moved/);
      assert.deepEqual(r.out, []);
      assert.equal(p.file("store/knowledge.jsonl"), initTexts().slice(0, 2).map((t) => t + "\n").join(""));
      copyFileSync(FIXTURE, join(p.dir, "fixture.md"));
      assert.equal(p.lattice("import-md", "fixture.md").code, 0);
      const a = p.lattice("apply", onlyProposal(p));
      assert.equal(a.code, 2);
      assert.match(a.err.join("\n"), /LG-G04: seq 3/);
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-017 an initialised store opens: apply of a fresh import runs (control)", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("import-md", "fixture.md").code, 0);
      assert.equal(p.lattice("apply", onlyProposal(p)).code, 0);
    } finally {
      p.dispose();
    }
  });
});
