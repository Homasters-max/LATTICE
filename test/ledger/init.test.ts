// Store init and the basis of records (REQ-LG-008, REQ-LG-009, REQ-CT-002).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apply, bases, GENESIS_HASH, commitHash, parseProposal, proposalHash } from "../../src/ledger/index.ts";
import type { Commit, Proposal } from "../../src/ledger/index.ts";
import { liveRevision, policyOf } from "../../src/trust/index.ts";
import { fixtureIntents, initTexts, ledgerOf, textOf } from "./cases.ts";
import type { Json } from "./cases.ts";

const commits = (texts: readonly string[]): Commit[] => texts.map((t) => JSON.parse(t) as Commit);
const ownerAct = (c: Commit) => [{ login: "Homasters-max", names: [c.proposal], ref: "store/lattice.json" }];

describe("SCN-LG-011 the four commits of store init", () => {
  const init = commits(initTexts());

  it("SCN-LG-011 genesis, std, the namespace and setup with its live fact, each with the owner's act after genesis", () => {
    assert.deepEqual(init.map((c) => c.seq), [1, 2, 3, 4]);
    assert.equal(commitHash(init[0] as Commit), GENESIS_HASH);
    const [, std, , setup] = init as [Commit, Commit, Commit, Commit];
    assert.deepEqual(std.records.map((r) => [r.id, "rev" in r ? r.rev : undefined]), [
      ["std/live", 1],
      ["std/namespace", 1],
      ["std/setup", 1],
      ["std/00000000000000000000000001", undefined],
    ]);
    assert.deepEqual(setup.records.map((r) => [r.id, r.type]), [
      ["lattice/setup", "std/setup@1"],
      ["lattice/00000000000000000000000003", "core/session@1"],
      ["lattice/00000000000000000000000004", "std/live@1"],
    ]);
    assert.deepEqual((setup.records[0] as { body: unknown }).body, {
      ports: Object.fromEntries(["clock", "ids", "judge", "llm", "source"].map((p) => [p, { memo: false, mode: "fixture" }])),
    });
    for (const c of init.slice(1)) assert.deepEqual(c.acts, ownerAct(c));
    assert.equal(Object.hasOwn(init[0] as Commit, "acts"), false);
    const events = init.flatMap((c) => c.records.filter((r) => !("rev" in r)));
    assert.equal(liveRevision(events, "lattice/setup"), 1);
  });

  it("SCN-LG-011 the sequence again gives the same four commit texts", () => {
    assert.deepEqual(initTexts(), initTexts());
  });
});

describe("SCN-CT-002 the namespace commit of a new store", () => {
  it("SCN-CT-002 commit 3 holds lattice/namespace with the owner's policy, the owner's act, basis derived", () => {
    const c = commits(initTexts())[2] as Commit;
    assert.deepEqual(c.records.map((r) => [r.id, "rev" in r ? r.rev : undefined, r.type]), [
      ["lattice/namespace", 1, "std/namespace@1"],
      ["lattice/00000000000000000000000002", undefined, "core/session@1"],
    ]);
    const body = (c.records[0] as { body: unknown }).body;
    assert.deepEqual(body, { owner: "Homasters-max", owner_acts: [], writers: [{ login: "Homasters-max" }] });
    assert.ok(policyOf(body).ok);
    assert.deepEqual(c.acts, ownerAct(c));
    assert.equal(bases(c).get("lattice/namespace" as never), "derived");
  });
});

describe("SCN-LG-013 bases of the init commits and of acted and unacted records", () => {
  const texts = initTexts();
  const ledger = ledgerOf(texts);
  const proposalOf = (intents: readonly unknown[]): Proposal => {
    const parsed = parseProposal(textOf(intents));
    if (!parsed.ok) throw new Error("form");
    return parsed.proposal;
  };
  const commitOf = (p: Proposal, acts: readonly { login: string; names: string[]; ref: string }[] = []): Commit => {
    const answer = apply(ledger, p, acts);
    if (answer.outcome !== "commit") throw new Error(answer.outcome);
    return answer.commit;
  };
  const basesOf = (c: Commit) => [...bases(c).entries()];

  it("SCN-LG-013 genesis records are inferred, the records of commits 2–4 derived", () => {
    const [genesis, ...rest] = commits(texts);
    assert.ok(basesOf(genesis as Commit).every(([, b]) => b === "inferred"));
    for (const c of rest) assert.ok(basesOf(c).every(([, b]) => b === "derived"));
  });

  it("SCN-LG-013 the fixture commit without acts is inferred; an act on one id lifts only that record", () => {
    const p = proposalOf(fixtureIntents(5));
    assert.ok(basesOf(commitOf(p)).every(([, b]) => b === "inferred"));
    const acted = basesOf(commitOf(p, [{ login: "Homasters-max", names: ["lattice/fx-a02"], ref: "u" }]));
    for (const [id, b] of acted) assert.equal(b, id === "lattice/fx-a02" ? "derived" : "inferred", id);
  });

  it("SCN-LG-013 an agent session with an act on the proposal hash gives asserted", () => {
    const intents = fixtureIntents(5).map((x: Json) =>
      x.kind === "event" ? { ...x, body: { of: {}, participant: "homasters", kind: "agent", purpose: "work" } } : x,
    );
    const p = proposalOf(intents);
    const c = commitOf(p, [{ login: "Homasters-max", names: [proposalHash(p)], ref: "u" }]);
    assert.ok(basesOf(c).every(([, b]) => b === "asserted"));
  });
});
