// apply (REQ-CL-004).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonical, hash } from "../../src/kernel/index.ts";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";
import { ulidIds } from "../../src/adapters/ids-ulid/index.ts";
import { counterIds } from "../../src/adapters/ids-counter/index.ts";
import { newId } from "../../src/kernel/index.ts";
import type { Store } from "../../src/ledger/ports/store.ts";
import { initialised, onlyProposal } from "./project.ts";
import type { Project } from "./project.ts";

type Json = Record<string, unknown>;

const commitsOf = (p: Project): Json[] =>
  p.file("store/knowledge.jsonl").split("\n").filter((l) => l !== "").map((l) => JSON.parse(l) as Json);

function imported(p: Project): string {
  const r = p.lattice("import-md", "fixture.md");
  assert.equal(r.code, 0, r.err.join("\n"));
  return onlyProposal(p);
}

describe("SCN-CL-005 the fixture proposal becomes the first commit", () => {
  it("SCN-CL-005 one canonical commit line with the header and the records in canonical order", () => {
    const p = initialised();
    try {
      const proposal = imported(p);
      const intents = (JSON.parse(p.file(proposal)) as { intents: Json[] }).intents;
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 0, r.err.join("\n"));
      assert.deepEqual(r.out, ['{"outcome":"commit","seq":1}']);
      assert.equal(p.exists(proposal), false);
      const text = p.file("store/knowledge.jsonl");
      assert.ok(text.endsWith("\n") && text.split("\n").length === 2);
      const commit = JSON.parse(text) as Json;
      const c = canonical(commit);
      assert.ok(c.ok && c.value + "\n" === text, "the line is the canonical JSON of the commit");
      const h = hash("core/proposal", intents);
      assert.ok(h.ok);
      const session = "lattice/00000000000000000000000001";
      assert.deepEqual(
        { ...commit, records: undefined },
        { seq: 1, prev: null, kernel: "0", base: 0, proposal: h.value, by: session, at: "1970-01-01T00:00:00.000Z", records: undefined },
      );
      const records = commit.records as Json[];
      assert.deepEqual(
        records.map((x) => [x.id, x.rev]),
        [["lattice/fixture", 1], ["lattice/fx-a01", 1], ["lattice/fx-a02", 1], ["lattice/fx-a03", 1], [session, undefined]],
      );
      const row = records[1] as Json;
      const rowHash = hash("lattice/table.rule", row.body);
      assert.ok(rowHash.ok);
      assert.equal(row.hash, rowHash.value, "design I-1: the kernel hash of the type without @n");
      assert.equal(row.at, "1970-01-01T00:00:00.000Z");
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-005 the JSONL store appends after the expected seq and answers moved otherwise", () => {
    const p = initialised();
    try {
      const store = jsonlStore(join(p.dir, "store", "knowledge.jsonl"));
      assert.deepEqual(store.read(), { commits: [], torn: null });
      assert.deepEqual(store.append({ seq: 1, text: '{"seq":1}' }, 1), { ok: false, reason: "moved" });
      assert.deepEqual(store.append({ seq: 1, text: '{"seq":1}' }, 0), { ok: true });
      assert.deepEqual(store.read(), { commits: [{ seq: 1, text: '{"seq":1}' }], torn: null });
      p.write("store/knowledge.jsonl", '{"seq":1}\n{"seq":2}');
      assert.deepEqual(store.read().torn, '{"seq":2}');
      assert.deepEqual(store.append({ seq: 2, text: "{}" }, 1), { ok: false, reason: "moved" });
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-005 ids for the session", () => {
  it("SCN-CL-005 ids-ulid and ids-counter give ULIDs the kernel accepts, distinct ones", () => {
    for (const ids of [ulidIds(), counterIds()]) {
      const a = ids.ulid();
      const b = ids.ulid();
      assert.match(a, /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
      assert.notEqual(a, b);
      assert.ok(newId("lattice", a).ok);
    }
  });
});

describe("SCN-CL-006 a second import of the same table is rejected by LG-P02", () => {
  it("SCN-CL-006 four LG-P02 rejections, the ledger unchanged, the proposal kept", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("apply", imported(p)).code, 0);
      const ledger = p.file("store/knowledge.jsonl");
      const proposal = imported(p);
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 1);
      const rejections = JSON.parse(r.out[0] as string) as Json[];
      assert.deepEqual(
        rejections.map(({ message: _, ...rest }) => rest),
        ["lattice/fixture", "lattice/fx-a01", "lattice/fx-a02", "lattice/fx-a03"].map((intent, i) => ({
          intent,
          rule: "LG-P02",
          path: `/intents/${i}/base`,
          expected: 1,
          got: 0,
        })),
      );
      assert.equal(p.file("store/knowledge.jsonl"), ledger);
      assert.ok(p.exists(proposal));
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-007 a malformed proposal is rejected by LG-P01 and LG-C07", () => {
  const variants: { readonly name: string; readonly change: (intents: Json[]) => void; readonly expect: Json }[] = [
    {
      name: "without the session event",
      change: (xs) => void xs.splice(4, 1),
      expect: { intent: null, rule: "LG-P01", path: "/intents", expected: 1, got: 0 },
    },
    {
      name: "with the by of intent 1 removed",
      change: (xs) => void delete (xs[1] as Json).by,
      expect: { intent: "lattice/fx-a01", rule: "LG-P01", path: "/intents/1/by", expected: null, got: null },
    },
    {
      name: "with the by of intent 1 another session",
      change: (xs) => void ((xs[1] as Json).by = "lattice/00000000000000000000000009"),
      expect: {
        intent: "lattice/fx-a01",
        rule: "LG-P01",
        path: "/intents/1/by",
        expected: "lattice/00000000000000000000000001",
        got: "lattice/00000000000000000000000009",
      },
    },
    {
      name: "with intent 1 twice",
      change: (xs) => void xs.push(xs[1] as Json),
      expect: { intent: "lattice/fx-a01", rule: "LG-C07", path: "/intents/5/id", expected: null, got: null },
    },
  ];

  for (const v of variants) {
    it(`SCN-CL-007 a proposal ${v.name} gives exactly one rejection`, () => {
      const p = initialised();
      try {
        const proposal = imported(p);
        const value = JSON.parse(p.file(proposal)) as { intents: Json[] };
        v.change(value.intents);
        p.write(proposal, JSON.stringify(value));
        const r = p.lattice("apply", proposal);
        assert.equal(r.code, 1, r.err.join("\n"));
        const rejections = JSON.parse(r.out[0] as string) as Json[];
        assert.equal(rejections.length, 1);
        const { message, ...rest } = rejections[0] as Json;
        assert.ok(typeof message === "string" && message !== "");
        assert.deepEqual(rest, v.expect);
        assert.equal(p.file("store/knowledge.jsonl"), "");
      } finally {
        p.dispose();
      }
    });
  }

  it("SCN-CL-007 one LG-P01 per intent at its first failing check; text and top level", () => {
    const p = initialised();
    try {
      const proposal = imported(p);
      const value = JSON.parse(p.file(proposal)) as { intents: Json[] };
      (value.intents[1] as Json).kind = "thing";
      (value.intents[2] as Json).base = -1;
      (value.intents[2] as Json).extra = 1;
      (value.intents[3] as Json).zzz = 1;
      value.intents.push(7 as unknown as Json);
      p.write(proposal, JSON.stringify(value));
      const r = p.lattice("apply", proposal);
      const got = (JSON.parse(r.out[0] as string) as Json[]).map((x) => [x.intent, x.path]);
      assert.deepEqual(got, [
        [null, "/intents/5"],
        ["lattice/fx-a01", "/intents/1/kind"],
        ["lattice/fx-a02", "/intents/2/base"],
        ["lattice/fx-a03", "/intents/3/zzz"],
      ]);
      for (const [text, path] of [["not json", ""], ['{"intents":[],"x":1}', ""], ['{"intents":{}}', "/intents"]]) {
        p.write(proposal, text as string);
        const one = JSON.parse(p.lattice("apply", proposal).out[0] as string) as Json[];
        assert.deepEqual(one.map((x) => [x.rule, x.path]), [["LG-P01", path]]);
      }
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-007 a proposal file that is not UTF-8 is rejected by LG-P01 at the top level", () => {
    const p = initialised();
    try {
      const proposal = imported(p);
      writeFileSync(join(p.dir, proposal), Buffer.from([0x7b, 0xff, 0x7d]));
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 1);
      const one = JSON.parse(r.out[0] as string) as Json[];
      assert.deepEqual(one.map((x) => [x.rule, x.path, x.intent]), [["LG-P01", "", null]]);
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-007 a file outside store/proposals/ is a usage refusal", () => {
    const p = initialised();
    try {
      p.write("elsewhere.json", "{}");
      assert.equal(p.lattice("apply", "elsewhere.json").code, 2);
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-011 a tail that moved during apply is refused", () => {
  it("SCN-CL-011 the store answers moved: code 2 naming LG-C03, nothing appended, the proposal stays", () => {
    let real: Store | null = null;
    const moving: Store = {
      read: () => (real as Store).read(),
      append: () => ({ ok: false, reason: "moved" }),
    };
    const p = initialised({ store: moving });
    real = jsonlStore(join(p.dir, "store", "knowledge.jsonl"));
    try {
      const proposal = imported(p);
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 2);
      assert.match(r.err.join("\n"), /LG-C03/);
      assert.equal(p.file("store/knowledge.jsonl"), "");
      assert.ok(p.exists(proposal));
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-008 a broken hash chain is refused", () => {
  it("SCN-CL-008 a changed letter in commit 1 is found at seq 2; ledger and proposal unchanged", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("apply", imported(p)).code, 0);
      const ledger = p.file("store/knowledge.jsonl").replace("synthetic rule of the walking", "synthetic rule of the walkinG");
      // a second commit on top: the second fixture row at expected revision 1
      const second = imported(p);
      const value = JSON.parse(p.file(second)) as { intents: Json[] };
      value.intents = value.intents.filter((x) => x.id === "lattice/fx-a02" || x.kind === "event");
      (value.intents[0] as Json).base = 1;
      p.write(second, JSON.stringify(value));
      assert.equal(p.lattice("apply", second).code, 0);
      const two = p.file("store/knowledge.jsonl").split("\n");
      const tampered = [ledger.split("\n")[0], two[1], ""].join("\n");
      p.write("store/knowledge.jsonl", tampered);
      const third = imported(p);
      const r = p.lattice("apply", third);
      assert.equal(r.code, 2);
      assert.match(r.err.join("\n"), /LG-C04/);
      assert.match(r.err.join("\n"), /seq 2/);
      assert.equal(p.file("store/knowledge.jsonl"), tampered);
      assert.ok(p.exists(third));
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-008 a complete commit without its line feed is named by its seq", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("apply", imported(p)).code, 0);
      const line = p.file("store/knowledge.jsonl");
      const proposal = imported(p);
      p.write("store/knowledge.jsonl", line + line.slice(0, -1).replace('"seq":1', '"seq":2'));
      assert.match(p.lattice("apply", proposal).err.join("\n"), /LG-C04: seq 2: a tail without a commit end marker/);
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-008 a ledger that is not UTF-8, a directory, or missing is refused with code 2", () => {
    const p = initialised();
    try {
      const proposal = imported(p);
      writeFileSync(join(p.dir, "store", "knowledge.jsonl"), Buffer.from([0xff, 0x0a]));
      assert.equal(p.lattice("apply", proposal).code, 2);
      rmSync(join(p.dir, "store", "knowledge.jsonl"));
      assert.equal(p.lattice("apply", proposal).code, 2);
      mkdirSync(join(p.dir, "store", "knowledge.jsonl"));
      assert.equal(p.lattice("apply", proposal).code, 2);
      assert.ok(p.exists(proposal));
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-008 a torn tail and a non-canonical line are refused naming LG-C04", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("apply", imported(p)).code, 0);
      const line = p.file("store/knowledge.jsonl");
      const proposal = imported(p);
      p.write("store/knowledge.jsonl", line + '{"seq":2');
      assert.match(p.lattice("apply", proposal).err.join("\n"), /LG-C04: line 2/);
      p.write("store/knowledge.jsonl", " " + line);
      assert.match(p.lattice("apply", proposal).err.join("\n"), /LG-C04: seq 1/);
    } finally {
      p.dispose();
    }
  });
});
