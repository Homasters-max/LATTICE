// The command table and init (REQ-CL-001, REQ-CL-002).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { project } from "./project.ts";

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
  it("SCN-CL-002 init writes the configuration, an empty ledger and proposals; a second init changes nothing", () => {
    const p = project();
    try {
      const first = p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max");
      assert.equal(first.code, 0);
      assert.equal(p.file("store/lattice.json"), '{"namespace":"lattice","owner":"Homasters-max"}\n');
      assert.equal(p.file("store/knowledge.jsonl"), "");
      assert.deepEqual(p.proposals(), []);
      assert.ok(p.exists("store/proposals"));
      const second = p.lattice("init", "--namespace", "other", "--owner", "someone");
      assert.equal(second.code, 2);
      assert.equal(p.file("store/lattice.json"), '{"namespace":"lattice","owner":"Homasters-max"}\n');
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
