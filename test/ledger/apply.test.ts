// Apply in process (REQ-LG-001…004, design D-2…D-6): the form of a proposal, duplicates with `with` and `differs`, the
// closed rule list, no-op and held intents, re-apply, and the check of the tail.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  checkTail,
  differs,
  EXEMPTIONS,
  GENESIS,
  parseProposal,
  proposalHash,
  REJECTION_RULES,
} from "../../src/ledger/index.ts";
import type { Applied, Proposal } from "../../src/ledger/index.ts";
import {
  applyText,
  initCase,
  initTexts,
  bare,
  committed,
  duplicateOfFirstRow,
  editing,
  fixtureIntents,
  ledgerOf,
  revisedIntents,
  revisionOf,
  ruleText,
  session,
  sessionOnly,
  textOf,
} from "./cases.ts";
import type { Json } from "./cases.ts";

function rejections(answer: Applied): Json[] {
  assert.equal(answer.outcome, "rejected");
  return answer.outcome === "rejected" ? answer.rejections.map(bare) : [];
}

function hashOf(intents: readonly unknown[]): string {
  const parsed = parseProposal(textOf(intents));
  assert.ok(parsed.ok);
  return parsed.ok ? proposalHash(parsed.proposal) : "";
}

describe("SCN-LG-001 a proposal outside the form is rejected by LG-P01", () => {
  it("SCN-LG-001 intents not a list, a missing base, two sessions: one LG-P01 each", () => {
    const empty = ledgerOf([]);
    assert.deepEqual(rejections(applyText(empty, '{"intents": 5}')), [
      { intent: null, rule: "LG-P01", path: "/intents", expected: null, got: null },
    ]);
    const noBase = fixtureIntents();
    assert.equal(noBase[2]?.id, "lattice/fx-a02");
    delete (noBase[2] as Json).base;
    assert.deepEqual(rejections(applyText(empty, textOf(noBase))), [
      { intent: "lattice/fx-a02", rule: "LG-P01", path: "/intents/2/base", expected: null, got: null },
    ]);
    const twoSessions = [...fixtureIntents(), ...sessionOnly(2)];
    assert.deepEqual(rejections(applyText(empty, textOf(twoSessions))), [
      { intent: null, rule: "LG-P01", path: "/intents", expected: 1, got: 2 },
    ]);
  });

  it("SCN-LG-001 the proposal hash does not depend on the order of the intents", () => {
    assert.equal(hashOf([...fixtureIntents()].reverse()), hashOf(fixtureIntents()));
  });
});

describe("SCN-LG-002 a duplicate names the id it collided with and the differing paths", () => {
  const empty = ledgerOf([]);
  const duplicated = (...extra: Json[]) => [...fixtureIntents(), ...extra];
  const copy = duplicateOfFirstRow;
  const c07 = (i: number, paths: string[]): Json => ({
    intent: "lattice/fx-a01",
    rule: "LG-C07",
    path: `/intents/${i}/id`,
    expected: null,
    got: null,
    with: "lattice/fx-a01",
    differs: paths,
  });

  it("SCN-LG-002 a changed duplicate differs at /body/Rule", () => {
    assert.deepEqual(rejections(applyText(empty, textOf(duplicated(copy("changed"))))), [c07(5, ["/body/Rule"])]);
  });

  it("SCN-LG-002 an unchanged duplicate differs nowhere", () => {
    assert.deepEqual(rejections(applyText(empty, textOf(duplicated(copy())))), [c07(5, [])]);
  });

  it("SCN-LG-002 three intents of one id: two rejections, each with the paths where the three differ", () => {
    assert.deepEqual(rejections(applyText(empty, textOf(duplicated(copy("changed"), copy())))), [
      c07(5, ["/body/Rule"]),
      c07(6, ["/body/Rule"]),
    ]);
  });

  it("SCN-LG-002 differs: a missing key, lists of other lengths, escaped keys, other kinds", () => {
    assert.deepEqual(differs([{ a: 1 }, { a: 1 }]), []);
    assert.deepEqual(differs([{ a: 1, b: 2 }, { a: 1 }]), ["/b"]);
    assert.deepEqual(differs([{ l: [1, 2] }, { l: [1, 3] }]), ["/l/1"]);
    assert.deepEqual(differs([{ l: [1, 2] }, { l: [1] }]), ["/l"]);
    assert.deepEqual(differs([{ "a/b": 1, "c~d": 1 }, { "a/b": 2, "c~d": 2 }]), ["/a~1b", "/c~0d"]);
    assert.deepEqual(differs([{ x: 1 }, [1]]), [""]);
    assert.deepEqual(differs([{ x: { y: 1 } }, { x: { y: 1 } }, { x: { y: 2 } }]), ["/x/y"]);
  });
});

describe("SCN-LG-007 the rule list is closed", () => {
  it("SCN-LG-007 the ledger module exports exactly CT-N02, LG-C03, LG-C07, LG-P01, LG-P02 and two exemptions", () => {
    assert.deepEqual([...REJECTION_RULES], ["CT-N02", "LG-C03", "LG-C07", "LG-P01", "LG-P02"]);
    assert.deepEqual(EXEMPTIONS, [
      { rule: "CT-N02", by: "LG-G01" },
      { rule: "CT-N02", by: "LG-G02" },
    ]);
  });
});

describe("SCN-LG-003 unchanged entities are a no-op, a changed one a commit of only itself", () => {
  const first = committed([], fixtureIntents(1));

  it("SCN-LG-003 the four entities at base 1 with their bodies unchanged are a no-op", () => {
    assert.deepEqual(applyText(ledgerOf(first), textOf(revisedIntents(2))), { outcome: "no-op" });
  });

  it("SCN-LG-003 a changed body: a commit holding that entity at rev 2 and the session, hashed over both", () => {
    const intents = revisedIntents(2, ruleText("lattice/fx-a02", "A changed second rule."));
    const answer = applyText(ledgerOf(first), textOf(intents));
    assert.equal(answer.outcome, "commit");
    if (answer.outcome !== "commit") return;
    const { commit } = answer;
    assert.equal(commit.seq, 2);
    assert.equal(commit.base, 1);
    assert.deepEqual(
      commit.records.map((r) => [r.id, "rev" in r ? r.rev : null]),
      [["lattice/fx-a02", 2], [session(2), null]],
    );
    const held = intents.filter((x) => x.id === "lattice/fx-a02" || x.kind === "event");
    assert.equal(commit.proposal, hashOf(held));
    assert.notEqual(commit.proposal, hashOf(intents));
  });

  it("SCN-LG-003 another type revision with the same body is a commit, not a no-op (OM-H01)", () => {
    const intents = revisedIntents(2, editing("lattice/fx-a01", (x) => (x.type = "lattice/table.rule@2")));
    const answer = applyText(ledgerOf(first), textOf(intents));
    assert.equal(answer.outcome, "commit");
    if (answer.outcome !== "commit") return;
    assert.deepEqual(
      answer.commit.records.map((r) => [r.id, "rev" in r ? r.rev : null, r.type]),
      [["lattice/fx-a01", 2, "lattice/table.rule@2"], [session(2), null, "core/session@1"]],
    );
  });

  it("SCN-LG-003 a proposal of only a session event is a no-op", () => {
    assert.deepEqual(applyText(ledgerOf(first), textOf(sessionOnly(2))), { outcome: "no-op" });
  });
});

describe("SCN-LG-004 a proposal already in the ledger answers its commit", () => {
  const first = committed([], fixtureIntents(1));

  it("SCN-LG-004 the fixture proposal answers seq 1, also after a later revision of fx-a02", () => {
    assert.deepEqual(applyText(ledgerOf(first), textOf(fixtureIntents(1))), { outcome: "existing", seq: 1 });
    const later = committed(first, revisionOf(2, "lattice/fx-a02", "A changed second rule."));
    assert.deepEqual(applyText(ledgerOf(later), textOf(fixtureIntents(1))), { outcome: "existing", seq: 1 });
  });

  it("SCN-LG-004 a partly no-op proposal answers its commit, until a no-op entity is written by another commit", () => {
    const partly = revisedIntents(2, ruleText("lattice/fx-a02", "A changed second rule."));
    const second = committed(first, partly);
    assert.deepEqual(applyText(ledgerOf(second), textOf(partly)), { outcome: "existing", seq: 2 });
    const third = committed(second, revisionOf(3, "lattice/fx-a01", "A changed first rule."));
    assert.deepEqual(
      rejections(applyText(ledgerOf(third), textOf(partly))).map((r) => [r.rule, r.intent]),
      [
        ["LG-P02", "lattice/fx-a01"],
        ["LG-P02", "lattice/fx-a02"],
      ],
    );
  });
});

describe("SCN-LG-005 a commit built on an older tail is rejected by LG-C03", () => {
  const built = applyText(ledgerOf([]), textOf(fixtureIntents(1)));

  it("SCN-LG-005 clear on its own tail, LG-C03 on a moved one, existing when the same proposal is there", () => {
    assert.equal(built.outcome, "commit");
    if (built.outcome !== "commit") return;
    assert.deepEqual(checkTail(ledgerOf([]), built.commit), { outcome: "clear" });
    const other = ledgerOf(committed([], fixtureIntents(2)));
    const moved = checkTail(other, built.commit);
    assert.equal(moved.outcome, "rejected");
    if (moved.outcome !== "rejected") return;
    assert.deepEqual(moved.rejections.map(bare), [
      { intent: null, rule: "LG-C03", path: "", expected: { seq: 0, hash: null }, got: { seq: 1, hash: other.tail?.hash } },
    ]);
    assert.ok(moved.rejections[0].message !== "");
    assert.deepEqual(checkTail(ledgerOf(committed([], fixtureIntents(1))), built.commit), { outcome: "existing", seq: 1 });
  });

  it("SCN-LG-005 a tail replaced at the same seq is a moved tail", () => {
    const base = committed([], fixtureIntents(2));
    const second = committed(base, revisionOf(3, "lattice/fx-a01", "x"));
    const onSecond = applyText(ledgerOf(second), textOf(revisionOf(4, "lattice/fx-a03", "y")));
    assert.equal(onSecond.outcome, "commit");
    if (onSecond.outcome !== "commit") return;
    const replaced = ledgerOf(committed(base, revisionOf(5, "lattice/fx-a01", "z")));
    assert.equal(replaced.tail?.seq, 2);
    const check = checkTail(replaced, onSecond.commit);
    assert.equal(check.outcome, "rejected");
    if (check.outcome !== "rejected") return;
    assert.deepEqual(check.rejections.map(bare)[0]?.got, { seq: 2, hash: replaced.tail?.hash });
  });
});

/** The proposal of `intents`, which must pass the form of LG-P01. */
function proposalOf(intents: readonly unknown[]): Proposal {
  const parsed = parseProposal(textOf(intents));
  if (!parsed.ok) throw new Error("the form of LG-P01");
  return parsed.proposal;
}

/** A copy of a proposal through JSON, changed by `edit`. */
function changed(p: Proposal, edit: (intents: Json[]) => void): Proposal {
  const intents = JSON.parse(JSON.stringify(p.intents)) as Json[];
  edit(intents);
  return proposalOf(intents);
}

const reservedOf = (answer: Applied): (string | null)[] =>
  rejections(answer).filter((r) => r.rule === "CT-N02").map((r) => r.intent as string | null);

describe("SCN-LG-008 reserved namespaces and their exemptions", () => {
  const empty = ledgerOf([]);
  const std = initCase()[1] as Proposal;
  const genesisLedger = ledgerOf(initTexts().slice(0, 1));
  const withRow = (id: string): Json[] => [
    ...fixtureIntents(1),
    { kind: "entity", id, type: "lattice/table.rule@1", base: 0, by: session(1), body: { Rule: "x" } },
  ];

  it("SCN-LG-008 std/x and std.y/x are rejected, stdx/x is not", () => {
    const one = applyText(empty, textOf(withRow("std/x")));
    assert.deepEqual(rejections(one).map((r) => [r.rule, r.intent, r.path]), [["CT-N02", "std/x", "/intents/5/id"]]);
    assert.deepEqual(reservedOf(applyText(empty, textOf(withRow("std.y/x")))), ["std.y/x"]);
    assert.equal(applyText(empty, textOf(withRow("stdx/x"))).outcome, "commit");
  });

  it("SCN-LG-008 a session in core is rejected", () => {
    const core = "core/01J8ZQ4N7X5K2M9R3T6V8W0Y1A";
    const intents = fixtureIntents(1).map((x) => ({ ...x, by: core, ...(x.kind === "event" ? { id: core } : {}) }));
    assert.deepEqual(reservedOf(applyText(empty, textOf(intents))), [core]);
  });

  it("SCN-LG-008 the genesis proposal is exempt by LG-G01 only as it is, only on an empty ledger", () => {
    assert.equal(apply(empty, GENESIS).outcome, "commit");
    const later = changed(GENESIS, (xs) => void ((xs.find((x) => x.kind === "event") as Json).at = "1970-01-01T00:00:00.001Z"));
    assert.equal(reservedOf(apply(empty, later)).length, 3);
  });

  it("SCN-LG-008 the std proposal is exempt by LG-G02 only right after genesis, unchanged, machine / init", () => {
    assert.equal(reservedOf(apply(empty, std)).length, 4);
    assert.equal(apply(genesisLedger, std).outcome, "commit");
    const body = changed(std, (xs) => {
      const live = xs.find((x) => x.id === "std/live") as Json;
      live.body = { schema: { type: "object", properties: {} } };
    });
    assert.equal(reservedOf(apply(genesisLedger, body)).length, 4);
    const work = changed(std, (xs) => {
      const s = xs.find((x) => x.kind === "event") as Json;
      s.body = { ...(s.body as Json), purpose: "work" };
    });
    assert.equal(reservedOf(apply(genesisLedger, work)).length, 4);
  });

  it("SCN-LG-008 the genesis proposal on the ledger of store init answers existing seq 1", () => {
    assert.deepEqual(apply(ledgerOf(initTexts()), GENESIS), { outcome: "existing", seq: 1 });
  });
});

describe("SCN-LG-012 acts that confirm intents become the act record", () => {
  const proposal = proposalOf(fixtureIntents(1));
  const h = proposalHash(proposal);
  const act = (names: string[], ref: string) => ({ login: "Homasters-max", names, ref });
  const a = act([h], "u1");

  it("SCN-LG-012 kept acts carry the check result, once, in order of canonical JSON", () => {
    const acts = [act(["lattice/zzz"], "u4"), act(["f".repeat(64)], "u3"), act(["lattice/fx-a02", "lattice/fx-a01"], "u2"), a, a];
    const answer = apply(ledgerOf([]), proposal, acts);
    assert.equal(answer.outcome, "commit");
    if (answer.outcome !== "commit") return;
    assert.deepEqual(answer.commit.acts, [act([answer.commit.proposal], "u1"), act(["lattice/fx-a01", "lattice/fx-a02"], "u2")]);
  });

  it("SCN-LG-012 without acts the commit has no key acts and is the commit of L1", () => {
    const answer = apply(ledgerOf([]), proposal);
    assert.equal(answer.outcome, "commit");
    if (answer.outcome !== "commit") return;
    assert.equal(Object.hasOwn(answer.commit, "acts"), false);
    assert.equal(answer.text, committed([], fixtureIntents(1))[0]);
  });

  it("SCN-LG-012 a no-op proposal stays a no-op with an act", () => {
    const l1 = ledgerOf(committed([], fixtureIntents(1)));
    assert.equal(apply(l1, proposalOf(revisedIntents(2)), [a]).outcome, "no-op");
  });
});
