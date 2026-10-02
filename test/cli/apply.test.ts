// apply (REQ-CL-004) on a store that holds the four commits of store init (REQ-CL-002, s0-bootstrap).

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
import { committed, fixtureIntents, IMPORT_SESSION, initTexts, ledgerOf, revisedIntents, session, textOf } from "../ledger/cases.ts";
import type { Project } from "./project.ts";

type Json = Record<string, unknown>;

const INIT = initTexts();
const INIT_LEDGER = INIT.map((t) => t + "\n").join("");
const INIT_TAIL = ledgerOf(INIT).tail;
const SESSION = session(IMPORT_SESSION);

const linesOf = (p: Project): string[] => p.file("store/knowledge.jsonl").split("\n").filter((l) => l !== "");

function imported(p: Project): string {
  const r = p.lattice("import-md", "fixture.md");
  assert.equal(r.code, 0, r.err.join("\n"));
  return onlyProposal(p);
}

describe("SCN-CL-005 the fixture proposal becomes the first commit", () => {
  it("SCN-CL-005 one canonical commit line after the init commits, with the header and the records in canonical order", () => {
    const p = initialised();
    try {
      assert.equal(p.file("store/knowledge.jsonl"), INIT_LEDGER);
      const proposal = imported(p);
      const intents = (JSON.parse(p.file(proposal)) as { intents: Json[] }).intents;
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 0, r.err.join("\n"));
      assert.deepEqual(r.out, ['{"outcome":"commit","seq":5}']);
      assert.equal(p.exists(proposal), false);
      const text = p.file("store/knowledge.jsonl");
      assert.ok(text.startsWith(INIT_LEDGER) && text.endsWith("\n"));
      const line = text.slice(INIT_LEDGER.length, -1);
      assert.ok(!line.includes("\n"), "one line after the init commits");
      const commit = JSON.parse(line) as Json;
      const c = canonical(commit);
      assert.ok(c.ok && c.value === line, "the line is the canonical JSON of the commit");
      const h = hash("core/proposal", intents);
      assert.ok(h.ok);
      assert.deepEqual(
        { ...commit, records: undefined },
        { seq: 5, prev: INIT_TAIL?.hash, kernel: "0", base: 4, proposal: h.value, by: SESSION, at: "1970-01-01T00:00:00.000Z", records: undefined },
      );
      assert.equal(Object.hasOwn(commit, "acts"), false, "apply passes no acts (REQ-CL-004)");
      const records = commit.records as Json[];
      assert.deepEqual(
        records.map((x) => [x.id, x.rev]),
        [["lattice/fixture", 1], ["lattice/fx-a01", 1], ["lattice/fx-a02", 1], ["lattice/fx-a03", 1], [SESSION, undefined]],
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
      const store = jsonlStore(join(p.dir, "other.jsonl"));
      assert.deepEqual(store.read(), { commits: [], torn: null });
      assert.deepEqual(store.append({ seq: 1, text: '{"seq":1}' }, 1), { ok: false, reason: "moved" });
      assert.deepEqual(store.append({ seq: 1, text: '{"seq":1}' }, 0), { ok: true });
      assert.deepEqual(store.read(), { commits: [{ seq: 1, text: '{"seq":1}' }], torn: null });
      p.write("other.jsonl", '{"seq":1}\n{"seq":2}');
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
        expected: SESSION,
        got: "lattice/00000000000000000000000009",
      },
    },
    {
      name: "with intent 1 twice",
      change: (xs) => void xs.push(xs[1] as Json),
      expect: {
        intent: "lattice/fx-a01",
        rule: "LG-C07",
        path: "/intents/5/id",
        expected: null,
        got: null,
        with: "lattice/fx-a01",
        differs: [],
      },
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
        assert.equal(p.file("store/knowledge.jsonl"), INIT_LEDGER);
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

/**
 * A store whose other writer acts between opening and appending, once armed: `before` runs, then the store answers
 * `moved`. Unarmed — during `init` — it appends through the JSONL store of the project.
 */
function racing(before: (real: Store, text: string) => void): { store: Store; bind(dir: string): void; arm(): void } {
  let real: Store | null = null;
  let armed = false;
  const store: Store = {
    read: () => (real as Store).read(),
    append: (commit, after) => {
      if (!armed) return (real as Store).append(commit, after);
      before(real as Store, commit.text);
      return { ok: false, reason: "moved" };
    },
  };
  return { store, bind: (dir) => void (real = jsonlStore(join(dir, "store", "knowledge.jsonl"))), arm: () => void (armed = true) };
}

function raced(race: ReturnType<typeof racing>): Project {
  const p = initialised({ store: race.store }, race.bind);
  race.arm();
  return p;
}

describe("SCN-CL-011 a tail that moved during apply is refused", () => {
  it("SCN-CL-011 another writer's commit lands first: one LG-C03 rejection, code 1, nothing appended", () => {
    const other = committed(INIT, fixtureIntents(9)).at(-1) as string;
    const race = racing((real) => assert.deepEqual(real.append({ seq: 5, text: other }, 4), { ok: true }));
    const p = raced(race);
    try {
      const proposal = imported(p);
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 1, r.err.join("\n"));
      const rejections = (JSON.parse(r.out[0] as string) as Json[]).map(({ message, ...rest }) => {
        assert.ok(typeof message === "string" && message !== "");
        return rest;
      });
      assert.deepEqual(rejections, [
        {
          intent: null,
          rule: "LG-C03",
          path: "",
          expected: { seq: 4, hash: INIT_TAIL?.hash },
          got: { seq: 5, hash: ledgerOf([...INIT, other]).tail?.hash },
        },
      ]);
      assert.equal(p.file("store/knowledge.jsonl"), INIT_LEDGER + other + "\n");
      assert.ok(p.exists(proposal));
    } finally {
      p.dispose();
    }
  });

  it("SCN-CL-011 a store answering moved on an unmoved tail is a store fault, code 2", () => {
    const race = racing(() => {});
    const p = raced(race);
    try {
      const proposal = imported(p);
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 2);
      assert.match(r.err.join("\n"), /store answered that the tail moved/);
      assert.equal(p.file("store/knowledge.jsonl"), INIT_LEDGER);
      assert.ok(p.exists(proposal));
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-012 an unchanged proposal is a no-op", () => {
  it("SCN-CL-012 the four entities at base 1 with a new session: no-op, ledger unchanged, proposal removed", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("apply", imported(p)).code, 0);
      const ledger = p.file("store/knowledge.jsonl");
      p.write("store/proposals/again.json", textOf(revisedIntents(6)));
      const r = p.lattice("apply", "store/proposals/again.json");
      assert.equal(r.code, 0, r.err.join("\n"));
      assert.deepEqual(r.out, ['{"outcome":"no-op"}']);
      assert.equal(p.file("store/knowledge.jsonl"), ledger);
      assert.ok(!p.exists("store/proposals/again.json"));
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-013 a proposal applied again answers its commit", () => {
  it("SCN-CL-013 the same proposal file written back: commit seq 5, ledger unchanged, proposal removed", () => {
    const p = initialised();
    try {
      const proposal = imported(p);
      const bytes = p.file(proposal);
      assert.equal(p.lattice("apply", proposal).code, 0);
      const ledger = p.file("store/knowledge.jsonl");
      p.write(proposal, bytes);
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 0, r.err.join("\n"));
      assert.deepEqual(r.out, ['{"outcome":"commit","seq":5}']);
      assert.equal(p.file("store/knowledge.jsonl"), ledger);
      assert.ok(!p.exists(proposal));
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-014 two writers of one proposal both answer its commit", () => {
  it("SCN-CL-014 the other writer appends the same commit and removes the file: code 0, commit seq 5", () => {
    let proposal = "";
    let dir = "";
    const race = racing((real, text) => {
      assert.deepEqual(real.append({ seq: 5, text }, 4), { ok: true });
      rmSync(join(dir, proposal));
    });
    const p = raced(race);
    dir = p.dir;
    try {
      proposal = imported(p);
      const r = p.lattice("apply", proposal);
      assert.equal(r.code, 0, r.err.join("\n"));
      assert.deepEqual(r.out, ['{"outcome":"commit","seq":5}']);
      assert.equal(linesOf(p).length, 5);
      assert.ok(!p.exists(proposal));
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-008 a broken hash chain is refused", () => {
  it("SCN-CL-008 a changed letter in commit 5 is found at seq 6; ledger and proposal unchanged", () => {
    const p = initialised();
    try {
      assert.equal(p.lattice("apply", imported(p)).code, 0);
      const five = linesOf(p)[4] as string;
      // a sixth commit on top: the second fixture row at expected revision 1, changed (unchanged would be a no-op)
      const second = imported(p);
      const value = JSON.parse(p.file(second)) as { intents: Json[] };
      value.intents = value.intents.filter((x) => x.id === "lattice/fx-a02" || x.kind === "event");
      (value.intents[0] as Json).base = 1;
      (value.intents[0] as Json).body = { Rule: "The second synthetic rule, changed." };
      p.write(second, JSON.stringify(value));
      assert.equal(p.lattice("apply", second).code, 0);
      const six = linesOf(p)[5] as string;
      const changed = five.replace("synthetic rule of the walking", "synthetic rule of the walkinG");
      assert.notEqual(changed, five);
      const tampered = INIT_LEDGER + changed + "\n" + six + "\n";
      p.write("store/knowledge.jsonl", tampered);
      const third = imported(p);
      const r = p.lattice("apply", third);
      assert.equal(r.code, 2);
      assert.match(r.err.join("\n"), /LG-C04/);
      assert.match(r.err.join("\n"), /seq 6/);
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
      const ledger = p.file("store/knowledge.jsonl");
      const five = linesOf(p)[4] as string;
      const proposal = imported(p);
      p.write("store/knowledge.jsonl", ledger + five.replace('"seq":5', '"seq":6'));
      assert.match(p.lattice("apply", proposal).err.join("\n"), /LG-C04: seq 6: a tail without a commit end marker/);
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
      const ledger = p.file("store/knowledge.jsonl");
      const proposal = imported(p);
      p.write("store/knowledge.jsonl", ledger + '{"seq":6');
      assert.match(p.lattice("apply", proposal).err.join("\n"), /LG-C04: line 6/);
      p.write("store/knowledge.jsonl", " " + ledger);
      assert.match(p.lattice("apply", proposal).err.join("\n"), /LG-C04: seq 1/);
    } finally {
      p.dispose();
    }
  });
});

describe("SCN-CL-016 a store outside the genesis chain is refused", () => {
  it("SCN-CL-016 L1 in place of the ledger: apply and export exit 2 naming LG-G01 and seq 1; an empty ledger LG-G04", () => {
    const p = initialised();
    try {
      const proposal = imported(p);
      const l1 = committed([], fixtureIntents(1));
      for (const [ledger, rule] of [[l1.map((t) => t + "\n").join(""), /LG-G01: seq 1/], ["", /LG-G04: seq 1/]] as const) {
        p.write("store/knowledge.jsonl", ledger);
        for (const argv of [["apply", proposal], ["export", "--out", "out"]]) {
          const r = p.lattice(...argv);
          assert.equal(r.code, 2, argv.join(" "));
          assert.match(r.err.join("\n"), rule);
        }
        assert.equal(p.file("store/knowledge.jsonl"), ledger);
        assert.ok(p.exists(proposal));
        assert.equal(p.exists("out"), false);
      }
    } finally {
      p.dispose();
    }
  });
});
