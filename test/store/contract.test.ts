// Contract tests of the `store` port (ST-T01, LG-S02, design D-7): every scenario of REQ-SR-001, REQ-SR-002 and
// REQ-SR-004 runs with the same code on the JSONL and the memory adapter. SCN-SR-013 runs with recovery off, every
// other scenario with recovery on.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Store } from "../../src/ledger/ports/store.ts";
import type { StoreOptions } from "../../src/adapters/store-jsonl/index.ts";
import type { Harness } from "./harness.ts";
import { clock, commit, harnesses } from "./harness.ts";

const texts = (s: Store): string[] => s.read().commits.map((c) => c.text);
const OK = { ok: true };
const MOVED = { ok: false, reason: "moved" };

/** Runs `body` on a fresh harness and disposes of it. */
function on(make: () => Harness, body: (h: Harness, store: (o?: StoreOptions) => Store) => void): void {
  const h = make();
  try {
    body(h, (o = {}) => h.make({ recover: true, ...o }));
  } finally {
    h.dispose();
  }
}

for (const make of harnesses) {
  const probe = make(); // only for its name; a JSONL harness makes a folder, so it is disposed of at once
  const name = probe.name;
  probe.dispose();

  describe(`store contract [${name}]`, () => {
    it(`SCN-SR-001 [${name}] a commit appended after the tail is read back`, () => {
      on(make, (_h, store) => {
        const a = store({ owner: "a" });
        assert.deepEqual(a.read(), { commits: [], torn: null });
        assert.deepEqual(a.append({ seq: 1, text: commit(1) }, 0), OK);
        assert.deepEqual(a.append({ seq: 1, text: "other" }, 0), MOVED);
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), OK);
        const b = store({ owner: "b" });
        for (const s of [a, b]) {
          assert.deepEqual(s.read(), {
            commits: [
              { seq: 1, text: commit(1) },
              { seq: 2, text: commit(2) },
            ],
            torn: null,
          });
        }
      });
    });

    it(`SCN-SR-002 [${name}] two writers append after the same tail`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        const a = store({ owner: "a" });
        const b = store({ owner: "b" });
        assert.deepEqual(texts(a), [commit(1)]);
        assert.deepEqual(texts(b), [commit(1)]);
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), OK);
        assert.deepEqual(b.append({ seq: 2, text: '{"seq":2,"by":"b"}' }, 1), MOVED);
        assert.deepEqual(texts(a), [commit(1), commit(2)]);
      });
    });

    it(`SCN-SR-003 [${name}] a lock left by a stopped writer blocks until it expires`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        h.lock("other", 10_000);
        const t = clock(9_999);
        const a = store({ owner: "a", now: t.now });
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.deepEqual(texts(a), [commit(1)]);
        assert.deepEqual(h.current(), { owner: "other", expires: 10_000 });
        t.set(10_000);
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), OK);
        h.unreadableLock();
        assert.deepEqual(a.append({ seq: 3, text: commit(3) }, 2), OK);
        h.lock("a", 20_000);
        assert.deepEqual(a.append({ seq: 4, text: commit(4) }, 3), OK);
        assert.deepEqual(texts(a), [commit(1), commit(2), commit(3), commit(4)]);
        assert.equal(h.held(10_000), false);
      });
    });

    it(`SCN-SR-004 [${name}] a writer that lost its lock writes nothing`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        const t = clock(0);
        const b = store({ owner: "b", ttl: 100, now: t.now });
        let answer: unknown = null;
        const a = store({
          owner: "a",
          ttl: 100,
          now: t.now,
          pause: (point) => {
            if (point !== "fence" || answer !== null) return;
            t.set(100);
            answer = b.append({ seq: 2, text: '{"seq":2,"by":"b"}' }, 1);
          },
        });
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.deepEqual(answer, OK);
        assert.deepEqual(texts(a), [commit(1), '{"seq":2,"by":"b"}']);
        assert.equal(h.held(100), false);
      });
      on(make, (h, store) => {
        h.seed([commit(1)]);
        const t = clock(0);
        const a = store({ owner: "a", ttl: 100, now: t.now, pause: (point) => point === "fence" && t.set(50) });
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.deepEqual(texts(a), [commit(1)]);
        assert.equal(h.held(50), false);
      });
    });

    it(`SCN-SR-008 [${name}] two writers take over one expired lock`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        h.lock("other", 5);
        const a = store({ owner: "a", now: () => 10, pause: (point) => point === "take" && h.lock("w", 1_000) });
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.deepEqual(texts(a), [commit(1)]);
        assert.deepEqual(h.current(), { owner: "w", expires: 1_000 });
      });
    });

    it(`SCN-SR-011 [${name}] a lock replaced in its place is not taken over`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        h.lock("other", 5);
        const a = store({ owner: "a", now: () => 10, pause: (point) => point === "take" && h.replaceLock("c", 1_000) });
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.deepEqual(texts(a), [commit(1)]);
        assert.deepEqual(h.current(), { owner: "c", expires: 1_000 });
      });
    });

    it(`SCN-SR-014 [${name}] a writer that lost its lock leaves the next holder's lock alone`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        const t = clock(0);
        const b = store({ owner: "b", ttl: 100, now: t.now });
        let answer: unknown = null;
        const a = store({
          owner: "a",
          ttl: 100,
          now: t.now,
          pause: (point) => {
            if (point !== "fence" || answer !== null) return;
            t.set(100);
            answer = b.append({ seq: 2, text: '{"seq":2,"by":"b"}' }, 1);
            h.lock("c", 1_000);
          },
        });
        assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.deepEqual(answer, OK);
        assert.deepEqual(texts(b), [commit(1), '{"seq":2,"by":"b"}']);
        assert.deepEqual(h.current(), { owner: "c", expires: 1_000 });
      });
    });

    it(`SCN-SR-006 [${name}] a torn tail is moved to recovered and never read`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        const piece = commit(2).slice(0, 20);
        h.tear(piece);
        const s = store({ owner: "s" });
        assert.deepEqual(s.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
        assert.deepEqual(h.recovered(), [piece]);
        assert.deepEqual(s.append({ seq: 2, text: commit(2) }, 1), OK);
        h.tear(commit(3));
        assert.deepEqual(s.read(), {
          commits: [
            { seq: 1, text: commit(1) },
            { seq: 2, text: commit(2) },
          ],
          torn: null,
        });
        assert.deepEqual(h.recovered(), [piece, commit(3)]);
        assert.deepEqual(s.read(), {
          commits: [
            { seq: 1, text: commit(1) },
            { seq: 2, text: commit(2) },
          ],
          torn: null,
        });
        assert.deepEqual(h.recovered(), [piece, commit(3)]);
        assert.equal(h.raw(), commit(1) + "\n" + commit(2) + "\n");
      });
    });

    it(`SCN-SR-007 [${name}] a tail under the live lock of another writer is left alone`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        h.tear(commit(2));
        h.lock("other", 1_000);
        const raw = h.raw();
        const s = store({ owner: "s", now: () => 0 });
        assert.deepEqual(s.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
        assert.deepEqual(s.append({ seq: 2, text: '{"seq":2,"by":"s"}' }, 1), MOVED);
        assert.equal(h.raw(), raw);
        assert.deepEqual(h.current(), { owner: "other", expires: 1_000 });
        assert.deepEqual(h.recovered(), []);
        h.completeTorn();
        h.removeLocks();
        assert.deepEqual(texts(s), [commit(1), commit(2)]);
        assert.deepEqual(h.recovered(), []);
      });
    });

    it(`SCN-SR-009 [${name}] a tail that completes before the lock is taken is not moved`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        h.tear(commit(2));
        const s = store({ owner: "s", now: () => 0, pause: (point) => point === "take" && h.completeTorn() });
        assert.deepEqual(texts(s), [commit(1), commit(2)]);
        assert.deepEqual(h.recovered(), []);
        assert.equal(h.held(0), false);
      });
    });

    it(`SCN-SR-012 [${name}] a recovery that lost its lock cuts nothing`, () => {
      on(make, (h, store) => {
        h.seed([commit(1)]);
        const piece = commit(2).slice(0, 20);
        h.tear(piece);
        const t = clock(0);
        const w = store({ owner: "w", ttl: 100, now: t.now });
        let answer: unknown = null;
        const r = store({
          owner: "r",
          ttl: 100,
          now: t.now,
          pause: (point) => {
            if (point !== "fence" || answer !== null) return;
            t.set(100);
            answer = w.append({ seq: 2, text: commit(2) }, 1);
          },
        });
        assert.deepEqual(r.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
        assert.deepEqual(answer, OK);
        assert.equal(h.raw(), commit(1) + "\n" + commit(2) + "\n");
        assert.deepEqual(h.recovered(), [piece, piece]);
        assert.equal(h.held(100), false);
      });
    });

    it(`SCN-SR-013 [${name}] with recovery off a torn tail is handed over`, () => {
      on(make, (h) => {
        h.seed([commit(1)]);
        const piece = commit(2).slice(0, 20);
        h.tear(piece);
        const raw = h.raw();
        const s = h.make({ owner: "s", now: () => 0 });
        assert.deepEqual(s.read(), { commits: [{ seq: 1, text: commit(1) }], torn: piece });
        assert.deepEqual(s.append({ seq: 2, text: commit(2) }, 1), MOVED);
        assert.equal(h.held(0), false);
        h.lock("other", 1_000);
        assert.deepEqual(s.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
        assert.equal(h.raw(), raw);
        assert.deepEqual(h.recovered(), []);
      });
    });

    it(`SCN-SR-001 [${name}] an owner, a TTL or a clock reading outside the contract is refused`, () => {
      on(make, (h) => {
        assert.throws(() => h.make({ owner: "not an owner" }), RangeError);
        assert.throws(() => h.make({ owner: "x".repeat(65) }), RangeError);
        assert.throws(() => h.make({ ttl: 1 }), RangeError);
        assert.throws(() => h.make({ ttl: 2.5 }), RangeError);
        const s = h.make({ owner: "s", now: () => 1.5 });
        assert.throws(() => s.append({ seq: 1, text: commit(1) }, 0), RangeError);
        const before = h.make({ owner: "before", now: () => -1 });
        assert.throws(() => before.append({ seq: 1, text: commit(1) }, 0), RangeError);
        const late = h.make({ owner: "late", now: () => Number.MAX_SAFE_INTEGER });
        assert.throws(() => late.append({ seq: 1, text: commit(1) }, 0), RangeError);
        assert.equal(h.raw(), "");
      });
    });
  });
}
