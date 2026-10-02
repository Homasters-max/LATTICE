// Genesis, the std package and opening a store (REQ-LG-006, REQ-LG-007, REQ-LG-010).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { admit, canonical, metaType } from "../../src/kernel/index.ts";
import {
  apply,
  commitHash,
  GENESIS,
  GENESIS_HASH,
  openLedger,
  openStore,
  packageHash,
  readStd,
  STD_HASH,
} from "../../src/ledger/index.ts";
import type { Commit } from "../../src/ledger/index.ts";
import { committed, fixtureIntents, initCase, initTexts, ledgerOf, stdText } from "./cases.ts";

/** The pinned literals of the frozen constants of kernel `0` and of this LATTICE version. */
const GENESIS_LITERAL = "fbbed761c8fdca026cf0690aace65de7728edfb0a1c24082f23083077bc4099b";
const STD_LITERAL = "1caa163883681578a53c8ab35ca07a7c9964174e04f49c5f6d1a715f7683c416";

const stored = (texts: readonly string[]) => ({
  commits: texts.map((text) => ({ seq: (JSON.parse(text) as { seq: number }).seq, text })),
  torn: null,
});

const admitted = (body: unknown): boolean => {
  const text = canonical(body);
  return text.ok && admit(text.value, metaType).ok;
};

describe("SCN-LG-009 the genesis commit", () => {
  it("SCN-LG-009 applied twice on an empty ledger it is the same constant commit", () => {
    const one = apply(ledgerOf([]), GENESIS);
    const two = apply(ledgerOf([]), GENESIS);
    assert.equal(one.outcome, "commit");
    assert.equal(two.outcome, "commit");
    if (one.outcome !== "commit" || two.outcome !== "commit") return;
    assert.equal(one.text, two.text);
    const c = one.commit;
    assert.deepEqual(
      [c.seq, c.prev, c.base, c.kernel, c.by, c.at, Object.hasOwn(c, "acts")],
      [1, null, 0, "0", "core/00000000000000000000000000", "1970-01-01T00:00:00.000Z", false],
    );
    assert.deepEqual(
      c.records.map((r) => [r.id, "rev" in r ? r.rev : undefined, r.type]),
      [
        ["core/session", 1, "core/type@1"],
        ["core/type", 1, "core/type@1"],
        ["core/00000000000000000000000000", undefined, "core/session@1"],
      ],
    );
    assert.equal(commitHash(c), GENESIS_HASH);
    assert.equal(GENESIS_HASH, GENESIS_LITERAL);
  });

  it("SCN-LG-009 both type bodies are admitted under the meta-type", () => {
    for (const intent of GENESIS.intents.filter((x) => x.kind === "entity")) assert.ok(admitted(intent.body), intent.id);
  });
});

describe("SCN-LG-010 the std package is read and its hash checked", () => {
  it("SCN-LG-010 the package of the repository gives the std proposal; its hash is the constant", () => {
    const std = readStd(stdText());
    assert.ok(std.ok);
    if (!std.ok) return;
    assert.deepEqual(std.entities.map((e) => e.id), ["std/live", "std/namespace", "std/setup"]);
    assert.equal(packageHash(std.entities), STD_HASH);
    assert.equal(STD_HASH, STD_LITERAL);
    for (const e of std.entities) assert.ok(admitted(e.body), e.id);
    const proposal = initCase()[1];
    assert.deepEqual(proposal?.intents.map((x) => [x.kind, x.id]), [
      ["entity", "std/live"],
      ["entity", "std/namespace"],
      ["entity", "std/setup"],
      ["event", "std/00000000000000000000000001"],
    ]);
  });

  it("SCN-LG-010 a changed schema character or a missing line feed is refused naming LG-G02", () => {
    for (const text of [stdText().replace('"maxLength":128', '"maxLength":129'), stdText().slice(0, -1)]) {
      const r = readStd(text);
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.message, /^LG-G02/);
    }
  });
});

describe("SCN-LG-014 a store outside the genesis chain is refused", () => {
  const init = initTexts();
  const rebuilt = (texts: readonly string[], i: number, change: (c: Record<string, unknown>) => void): string[] => {
    const out: string[] = [];
    let prev: string | null = null;
    for (const [k, text] of texts.entries()) {
      const c = JSON.parse(text) as Record<string, unknown>;
      c.prev = prev;
      if (k === i) change(c);
      const t = canonical(c);
      if (!t.ok) throw new Error("canonical");
      out.push(t.value);
      prev = commitHash(c as unknown as Commit);
    }
    return out;
  };

  const cases: [string, string[], string, string | null][] = [
    ["the ledger of store init", init, "lattice", null],
    ["store init and one more commit", committed(init, fixtureIntents(5)), "lattice", null],
    ["an empty ledger", [], "lattice", "LG-G04: seq 1"],
    ["L1", committed([], fixtureIntents(1)), "lattice", "LG-G01: seq 1"],
    ["genesis and the fixture commit", committed(init.slice(0, 1), fixtureIntents(1)), "lattice", "LG-G02: seq 2"],
    [
      "genesis and std in a work session",
      rebuilt(init.slice(0, 2), 1, (c) => {
        const records = c.records as Record<string, unknown>[];
        const s = records.find((r) => r.id === c.by) as Record<string, unknown>;
        s.body = { ...(s.body as Record<string, unknown>), purpose: "work" };
      }),
      "lattice",
      "LG-G02: seq 2",
    ],
    ["commit 4 of kernel 1", rebuilt(init, 3, (c) => void (c.kernel = "1")), "lattice", "LG-G03: seq 4"],
    ["the first two commits", init.slice(0, 2), "lattice", "LG-G04: seq 3"],
    ["the first three commits", init.slice(0, 3), "lattice", "LG-G04: seq 4"],
    ["another namespace", init, "other", "LG-G04: seq 3"],
  ];

  for (const [name, texts, namespace, refusal] of cases) {
    it(`SCN-LG-014 ${name}: ${refusal ?? "opens"}; openLedger opens it`, () => {
      assert.ok(openLedger(stored(texts)).ok, "openLedger");
      const opened = openStore(stored(texts), namespace);
      if (refusal === null) assert.ok(opened.ok, opened.ok ? "" : opened.message);
      else {
        assert.equal(opened.ok, false);
        if (!opened.ok) assert.ok(opened.message.startsWith(refusal), opened.message);
      }
    });
  }
});
