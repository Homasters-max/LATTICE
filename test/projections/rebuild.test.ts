// A rebuild yields the same bytes (LG-J02, REQ-PJ-003, REQ-PJ-004): extension on the tail only, incremental against
// from scratch at every prefix, and every permutation of the projection list.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Commit } from "../../src/ledger/records.ts";
import { isEntityRecord } from "../../src/ledger/records.ts";
import type { ReadView } from "../../src/ledger/projections/view.ts";
import { PROJECTIONS, extend, rebuild, serialize } from "../../src/ledger/projections/view.ts";
import { commitsOf, skeletonCase, typedCase } from "./ledgers.ts";

const cases = () => [
  { name: "skeleton", commits: commitsOf(skeletonCase()) },
  { name: "typed", commits: commitsOf(typedCase()) },
];

function extended(view: ReadView, commit: Commit): ReadView {
  const next = extend(view, commit);
  if (!next.ok) throw new Error(`extend refused: ${JSON.stringify(next)}`);
  return next.view;
}

/** Equality of views (REQ-PJ-001): `seq`, the serialized text, and `revision` of every entity record of `commits`. */
function assertEqualViews(a: ReadView, b: ReadView, commits: readonly Commit[], label: string): void {
  assert.equal(a.seq, b.seq, label);
  assert.equal(serialize(a), serialize(b), label);
  for (const record of commits.flatMap((c) => c.records.filter(isEntityRecord))) {
    assert.equal(a.revision(record.id, record.rev), b.revision(record.id, record.rev), `${label} ${record.id}@${record.rev}`);
  }
}

function permutations<T>(list: readonly T[]): T[][] {
  if (list.length <= 1) return [[...list]];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));
}

describe("projections: rebuild, extend, serialize", () => {
  it("SCN-PJ-005 extension refuses a commit off the tail", () => {
    const commits = commitsOf(typedCase());
    const [c1, c2, c3, c4] = commits as [Commit, Commit, Commit, Commit];
    const two = rebuild([c1, c2]);
    const before = serialize(two);

    assert.deepEqual(extend(two, c4), { ok: false, tail: 2, base: 3, seq: 4 });
    const three = extend(two, c3);
    assert.ok(three.ok);
    assert.equal(three.view.seq, 3);
    assert.equal(three.view.revision("test/n1", 2)?.rev, 2);
    assert.deepEqual(extend(three.view, { ...c4, seq: 3 }), { ok: false, tail: 3, base: 3, seq: 3 });

    // two branches from one view: extending the first does not reach the second
    const other = extend(two, c3);
    assert.ok(other.ok);
    const four = extend(three.view, c4);
    assert.ok(four.ok);
    assert.equal(serialize(other.view), serialize(rebuild([c1, c2, c3])));
    assert.equal(other.view.revision("test/n1", 3), undefined);
    assert.equal(four.view.revision("test/n1", 3)?.rev, 3);

    assert.equal(two.seq, 2);
    assert.equal(serialize(two), before);
    assert.equal(two.revision("test/n1", 2), undefined);
    assert.throws(() => serialize({ ...two }));
    assert.throws(() => extend({ ...two }, c3));
  });

  it("SCN-PJ-006 incremental and from scratch give equal views", () => {
    for (const { name, commits } of cases()) {
      let view = rebuild([]);
      assert.equal(view.seq, 0);
      for (let k = 0; k <= commits.length; k++) {
        if (k > 0) view = extended(view, commits[k - 1] as Commit);
        assertEqualViews(view, rebuild(commits.slice(0, k)), commits, `${name} k=${k}`);
      }
    }
  });

  it("SCN-PJ-007 every order of the list gives the same bytes", () => {
    for (const { name, commits } of cases()) {
      const texts = permutations(PROJECTIONS).map((list) => serialize(rebuild(commits, list)));
      assert.ok(texts.length >= 2);
      for (const text of texts) assert.equal(text, texts[0], name);
      assert.deepEqual(Object.keys(JSON.parse(texts[0] as string) as object).sort(), ["latest", "referrers", "seq"]);
      assert.throws(() => rebuild(commits, [PROJECTIONS[0] as (typeof PROJECTIONS)[number]]), name);
    }
  });
});
