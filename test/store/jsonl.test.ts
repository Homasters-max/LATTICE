// JSONL-only tests of the `store` port (REQ-SR-003, REQ-SR-004, design D-5, D-7): the order of the file operations of
// an append, failures of the file system injected through the `fs` option, and a tail cut inside a character.

import { strict as assert } from "node:assert";
import * as nodeFs from "node:fs";
import { basename, join } from "node:path";
import { describe, it } from "node:test";
import type { JsonlFs } from "../../src/adapters/store-jsonl/index.ts";
import { jsonlStore } from "../../src/adapters/store-jsonl/index.ts";
import { commit, jsonlHarness } from "./harness.ts";

type Call = { readonly op: string; readonly file: string };

/**
 * A file system that records the calls of the adapter by the file they touch, and lets a test replace one call.
 * `fail(op, file, args)` returns `undefined` to let the call through, or a function to run instead.
 */
function recording(fail: (op: string, file: string, args: unknown[]) => (() => unknown) | undefined = () => undefined) {
  const calls: Call[] = [];
  const fds = new Map<number, string>();
  const fileOf = (op: string, args: unknown[]): string => {
    if (["writeSync", "fsyncSync", "closeSync", "ftruncateSync"].includes(op)) return fds.get(args[0] as number) ?? "?";
    if (op === "renameSync" || op === "linkSync") return basename(String(args[1]));
    return basename(String(args[0]));
  };
  const wrap = <K extends keyof JsonlFs>(op: K): JsonlFs[K] =>
    ((...args: unknown[]) => {
      const file = fileOf(op, args);
      calls.push({ op, file });
      const instead = fail(op, file, args);
      const out = instead !== undefined ? instead() : (nodeFs[op] as (...a: unknown[]) => unknown)(...args);
      if (op === "openSync") fds.set(out as number, file);
      return out;
    }) as JsonlFs[K];
  const fs: JsonlFs = {
    closeSync: wrap("closeSync"),
    fsyncSync: wrap("fsyncSync"),
    ftruncateSync: wrap("ftruncateSync"),
    linkSync: wrap("linkSync"),
    mkdirSync: wrap("mkdirSync"),
    openSync: wrap("openSync"),
    readFileSync: wrap("readFileSync"),
    readdirSync: wrap("readdirSync"),
    renameSync: wrap("renameSync"),
    unlinkSync: wrap("unlinkSync"),
    writeSync: wrap("writeSync"),
  };
  return { fs, calls };
}

const io = (message: string): Error => Object.assign(new Error(message), { code: "EIO" });
const LEDGER = "knowledge.jsonl";
const isLock = (file: string): boolean => /^knowledge\.jsonl\.lock\.[0-9]+$/.test(file);

describe("store JSONL adapter: durable appends", () => {
  it("SCN-SR-005 an append writes the line, flushes the ledger, releases the lock, then answers ok", () => {
    const h = jsonlHarness();
    try {
      h.seed([commit(1)]);
      const { fs, calls } = recording();
      const s = jsonlStore(h.file, { owner: "a", now: () => 0, fs });
      assert.deepEqual(s.append({ seq: 2, text: commit(2) }, 1), { ok: true });
      const at = (op: string, test: (file: string) => boolean): number => calls.findLastIndex((c) => c.op === op && test(c.file));
      const write = at("writeSync", (f) => f === LEDGER);
      const flush = at("fsyncSync", (f) => f === LEDGER);
      const release = at("renameSync", isLock);
      assert.ok(write >= 0 && flush > write && release > flush, JSON.stringify(calls));
      assert.equal(h.raw(), commit(1) + "\n" + commit(2) + "\n");
    } finally {
      h.dispose();
    }
  });

  it("SCN-SR-005 a write cut by a failure is thrown and recovered by the next opening", () => {
    const h = jsonlHarness();
    try {
      h.seed([commit(1)]);
      const line = new TextEncoder().encode(commit(2) + "\n");
      const half = Math.floor(line.length / 2);
      const { fs } = recording((op, file, args) =>
        op === "writeSync" && file === LEDGER
          ? () => {
              nodeFs.writeSync(args[0] as number, line, 0, half);
              throw io("disk full");
            }
          : undefined,
      );
      const a = jsonlStore(h.file, { owner: "a", now: () => 0, fs });
      assert.throws(() => a.append({ seq: 2, text: commit(2) }, 1), /disk full/);
      assert.equal(h.held(0), false);
      const b = jsonlStore(h.file, { owner: "b", now: () => 0, recover: true });
      assert.deepEqual(b.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
      assert.deepEqual(h.recovered(), [new TextDecoder().decode(line.subarray(0, half))]);
      assert.deepEqual(b.append({ seq: 2, text: commit(2) }, 1), { ok: true });
      assert.equal(h.raw(), commit(1) + "\n" + commit(2) + "\n");
    } finally {
      h.dispose();
    }
  });

  it("SCN-SR-005 a failed flush after the whole line is thrown and the commit stays", () => {
    const h = jsonlHarness();
    try {
      h.seed([commit(1)]);
      const { fs } = recording((op, file) =>
        op === "fsyncSync" && file === LEDGER
          ? () => {
              throw io("flush failed");
            }
          : undefined,
      );
      const a = jsonlStore(h.file, { owner: "a", now: () => 0, fs });
      assert.throws(() => a.append({ seq: 2, text: commit(2) }, 1), /flush failed/);
      assert.equal(h.held(0), false);
      assert.deepEqual(
        jsonlStore(h.file).read().commits.map((c) => c.text),
        [commit(1), commit(2)],
      );
    } finally {
      h.dispose();
    }
  });

  it("SCN-SR-005 a failed release is not thrown; the lock expires and is taken over", () => {
    const h = jsonlHarness();
    try {
      h.seed([commit(1)]);
      const { fs } = recording((op, file) =>
        op === "renameSync" && isLock(file)
          ? () => {
              throw io("cannot replace");
            }
          : undefined,
      );
      const a = jsonlStore(h.file, { owner: "a", ttl: 100, now: () => 0, fs });
      assert.deepEqual(a.append({ seq: 2, text: commit(2) }, 1), { ok: true });
      assert.deepEqual(h.current(), { owner: "a", expires: 100 });
      const b = jsonlStore(h.file, { owner: "b", ttl: 100, now: () => 200 });
      assert.deepEqual(b.append({ seq: 3, text: commit(3) }, 2), { ok: true });
      assert.equal(h.raw(), [1, 2, 3].map((n) => commit(n) + "\n").join(""));
      assert.equal(h.held(200), false);
    } finally {
      h.dispose();
    }
  });
});

describe("store JSONL adapter: recovery on bytes", () => {
  it("SCN-SR-006 a tail cut inside a character is recovered byte for byte", () => {
    const h = jsonlHarness();
    try {
      h.seed([commit(1)]);
      nodeFs.appendFileSync(h.file, Buffer.from([0xc3]));
      const s = jsonlStore(h.file, { owner: "s", recover: true });
      assert.deepEqual(s.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
      assert.deepEqual([...nodeFs.readFileSync(join(h.dir, "recovered", "knowledge.jsonl.1.torn"))], [0xc3]);
      assert.equal(h.raw(), commit(1) + "\n");
    } finally {
      h.dispose();
    }
  });

  it("SCN-SR-010 a failed recovery is thrown and repeated at the next opening", () => {
    const h = jsonlHarness();
    try {
      h.seed([commit(1)]);
      const piece = commit(2).slice(0, 20);
      h.tear(piece);
      const raw = h.raw();
      const { fs } = recording((op) =>
        op === "ftruncateSync"
          ? () => {
              throw io("cannot cut");
            }
          : undefined,
      );
      const a = jsonlStore(h.file, { owner: "a", now: () => 0, recover: true, fs });
      assert.throws(() => a.read(), /cannot cut/);
      assert.equal(h.held(0), false);
      assert.deepEqual(h.recovered(), [piece]);
      assert.equal(h.raw(), raw);
      const b = jsonlStore(h.file, { owner: "b", now: () => 0, recover: true });
      assert.deepEqual(b.read(), { commits: [{ seq: 1, text: commit(1) }], torn: null });
      assert.deepEqual(h.recovered(), [piece, piece]);
      assert.equal(h.raw(), commit(1) + "\n");
    } finally {
      h.dispose();
    }
  });
});
