// The adapters of the acts port (REQ-AC-002…REQ-AC-005).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRef } from "../../src/kernel/index.ts";
import { initActs } from "../../src/adapters/acts-init/index.ts";
import { fixtureActs } from "../../src/adapters/acts-fixture/index.ts";
import { recordedActs } from "../../src/adapters/acts-recorded/index.ts";
import { githubActs } from "../../src/adapters/acts-github/index.ts";
import type { Transport } from "../../src/adapters/acts-github/index.ts";
import { apply, openLedger } from "../../src/ledger/index.ts";
import type { Commit, Proposal } from "../../src/ledger/index.ts";
import { initTexts } from "../ledger/cases.ts";
import { H, K, OWNER, pr7, pr7Transport, recorded, REPO } from "./cases.ts";

describe("SCN-AC-002 the init adapter answers the owner", () => {
  it("SCN-AC-002 one act of the owner naming the asked hash, at store/lattice.json", () => {
    const acts = initActs(OWNER);
    assert.deepEqual(acts.actsOn(H), [{ login: OWNER, names: [H], ref: "store/lattice.json" }]);
    assert.deepEqual(acts.actsOn(K), [{ login: OWNER, names: [K], ref: "store/lattice.json" }]);
  });
});

describe("SCN-AC-003 fixture acts by hash and by intent", () => {
  const a = { login: OWNER, names: [H], ref: "a" };
  const b = { login: OWNER, names: [K], ref: "b" };
  const c = { login: OWNER, names: ["lattice/fx-a01"], ref: "c" };

  it("SCN-AC-003 the acts naming the hash or an intent id, in the given order", () => {
    const acts = fixtureActs([a, b, c]);
    assert.deepEqual(acts.actsOn(H), [a, c]);
    assert.deepEqual(acts.actsOn(K), [b, c]);
  });

  it("SCN-AC-003 an act outside the form is refused at build, naming its position", () => {
    assert.throws(() => fixtureActs([{ login: OWNER, names: [], ref: "x" }]), /fixture act 0/);
  });
});

describe("SCN-AC-004 a commit re-applied with its recorded acts gives the same bytes", () => {
  const texts = initTexts();
  const commits = texts.map((t) => JSON.parse(t) as Commit);

  it("SCN-AC-004 the act record of commit 3; nothing for genesis", () => {
    const acts = recordedActs(texts);
    const c3 = commits[2] as Commit;
    assert.deepEqual(acts.actsOn(c3.proposal), [{ login: OWNER, names: [c3.proposal], ref: "store/lattice.json" }]);
    assert.deepEqual(acts.actsOn((commits[0] as Commit).proposal), []);
  });

  it("SCN-AC-004 the intents of commits 2–4 re-applied with the recorded acts give each commit text", () => {
    const acts = recordedActs(texts);
    for (const i of [1, 2, 3]) {
      const c = commits[i] as Commit;
      const intents = c.records.map((r) =>
        "rev" in r
          ? { kind: "entity" as const, id: r.id, type: r.type, base: r.rev - 1, by: r.by, body: r.body }
          : { kind: "event" as const, id: r.id, type: r.type, by: r.by, at: r.at, body: r.body },
      );
      const session = intents.find((x) => x.id === c.by);
      if (session === undefined || session.kind !== "event") throw new Error("session");
      const proposal: Proposal = { intents, session };
      const opened = openLedger({ commits: texts.slice(0, i).map((text, k) => ({ seq: k + 1, text })), torn: null });
      assert.ok(opened.ok);
      if (!opened.ok) return;
      const answer = apply(opened.ledger, proposal, acts.actsOn(c.proposal));
      assert.equal(answer.outcome, "commit");
      if (answer.outcome === "commit") assert.equal(answer.text, texts[i]);
    }
  });

  it("SCN-AC-004 an act of a hand-edited record naming only another hash is not answered", () => {
    const acts = recordedActs([JSON.stringify({ seq: 1, proposal: H, acts: [{ login: OWNER, names: [K], ref: "x" }] })]);
    assert.deepEqual(acts.actsOn(H), []);
  });
});

describe("SCN-AC-005 comments and reviews become acts by author, text and pull request", () => {
  const options = (transport: Transport) => ({ repo: REPO, pr: 7, logins: [OWNER], transport });

  it("SCN-AC-005 by the owner, on the pull request, naming the hash or identifiers, in order of ref", () => {
    const acts = githubActs(options(pr7Transport())).actsOn(H);
    assert.deepEqual(acts, [
      { login: OWNER, names: [H], ref: "c1" },
      { login: OWNER, names: ["lattice/fx-a01"], ref: "c4" },
      { login: OWNER, names: ["store/lattice.json"], ref: "c6" },
      { login: OWNER, names: [H, "lattice/fx-a02"], ref: "r1" },
    ]);
    for (const n of acts.flatMap((a) => a.names).filter((n) => n !== H)) {
      const r = parseRef(n);
      assert.ok(r.ok && r.value.version === undefined, n);
    }
  });

  it("SCN-AC-005 every comment page is read once; a later call reads nothing more", () => {
    const pr = pr7();
    const full = Array.from({ length: 100 }, () => pr.comments[3]);
    const asked: string[] = [];
    const acts = githubActs(options(recorded({ comments: [full, [pr.comments[0]]], reviews: [[]] }, asked)));
    acts.actsOn(H);
    assert.deepEqual(
      asked.map((p) => p.replace(/^.*\/(issues|pulls)\/7\/(\w+)\?per_page=100&page=(\d+)$/, "$2 $3")),
      ["comments 1", "comments 2", "reviews 1"],
    );
    acts.actsOn(H);
    assert.equal(asked.length, 3);
  });

  it("SCN-AC-005 a failing transport throws and the next call reads again; a page not a list throws", () => {
    let calls = 0;
    const inner = pr7Transport();
    const flaky: Transport = (path) => {
      if (calls++ === 0) throw new Error("offline");
      return inner(path);
    };
    const acts = githubActs(options(flaky));
    assert.throws(() => acts.actsOn(H), /offline/);
    assert.equal(acts.actsOn(H).length, 4);
    const notList = githubActs(options((path) => (path.includes("/reviews") ? {} : [])));
    assert.throws(() => notList.actsOn(H), /not a list/);
  });
});
