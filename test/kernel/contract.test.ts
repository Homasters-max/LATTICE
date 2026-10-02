// Kernel contract: the frozen vector file (SCN-KR-041), RFC 8785 vectors (SCN-KR-037), round trip of references
// (SCN-KR-042), the meta-type (SCN-KR-054) and purity of every function on every input of its scenarios (SCN-KR-026).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as kernel from "../../src/kernel/index.ts";
import { cases, chainCases, deepCases, mustType, T_S, typeRecord } from "./vectors.ts";
import type { Case } from "./vectors.ts";

/** sha256 of the bytes of the vector file; the file never changes between kernel versions (OM-H05). */
const FROZEN = "6f88e0d1ff991cf3562882936016faa65f3bd40bec4fd0f7558bed98d1c32453";

const bytes = readFileSync(new URL("../fixtures/jcs-vectors.json", import.meta.url));

type Fixture = {
  section_3_2_2: {
    input: { numbers: number[]; string_code_points: number[]; literals: unknown[] };
    expected_utf8_hex: string;
  };
  section_3_2_3: { members: [number[], string][]; expected_key_order: number[][] };
  appendix_b: { vectors: [string, string | null][] };
  nfc: { vectors: [number[], number[]][] };
  hash: { vectors: string[] };
};

const fixture = JSON.parse(bytes.toString("utf8")) as Fixture;

describe("SCN-KR-041 the frozen vector file", () => {
  it("SCN-KR-041 the bytes of the file are frozen", () => {
    assert.equal(createHash("sha256").update(bytes).digest("hex"), FROZEN);
  });

  it("SCN-KR-041 the eight NFC vectors", () => {
    const pairs = [
      [[0x65, 0x301], [0xe9]],
      [[0x41, 0x30a], [0xc5]],
      [[0x212b], [0xc5]],
      [[0x212a], [0x4b]],
      [[0x1e9b, 0x323], [0x1e9b, 0x323]],
      [[0x1100, 0x1161], [0xac00]],
      [[0x958], [0x915, 0x93c]],
      [[0xe9], [0xe9]],
    ];
    assert.deepEqual(fixture.nfc.vectors, pairs);
    assert.equal(fixture.hash.vectors.length, pairs.length);
  });

  fixture.nfc.vectors.forEach(([input, nfc], i) => {
    it(`SCN-KR-041 NFC and hash vector ${String(i)}`, () => {
      const form = String.fromCodePoint(...nfc);
      for (const s of [String.fromCodePoint(...input), form]) {
        const a = kernel.admit(JSON.stringify({ s }), T_S);
        assert.ok(a.ok, JSON.stringify(a));
        assert.equal((a.value.body as { s: string }).s, form);
        assert.equal(a.value.hash, fixture.hash.vectors[i]);
      }
    });
  });
});

describe("SCN-KR-037 RFC 8785 vectors", () => {
  it("SCN-KR-037 section 3.2.2: output bytes of 3.2.4", () => {
    const i = fixture.section_3_2_2.input;
    const value = { numbers: i.numbers, string: String.fromCodePoint(...i.string_code_points), literals: i.literals };
    const res = kernel.canonical(value);
    assert.ok(res.ok);
    assert.equal(Buffer.from(res.value, "utf8").toString("hex"), fixture.section_3_2_2.expected_utf8_hex);
  });

  it("SCN-KR-037 section 3.2.3: property sorting", () => {
    const members = fixture.section_3_2_3.members.map(([k, v]) => [String.fromCodePoint(...k), v] as const);
    const value = Object.fromEntries(members);
    const expected =
      "{" +
      fixture.section_3_2_3.expected_key_order
        .map((k) => String.fromCodePoint(...k))
        .map((k) => JSON.stringify(k) + ":" + JSON.stringify(value[k]))
        .join(",") +
      "}";
    assert.deepEqual(kernel.canonical(value), { ok: true, value: expected });
  });

  for (const [bits, expected] of fixture.appendix_b.vectors) {
    it(`SCN-KR-037 appendix B: ${bits}`, () => {
      const view = new DataView(new ArrayBuffer(8));
      view.setBigUint64(0, BigInt("0x" + bits));
      const res = kernel.canonical(view.getFloat64(0));
      if (expected === null) assert.deepEqual(res, { ok: false, errors: [{ code: "not-json", path: "" }] });
      else assert.deepEqual(res, { ok: true, value: expected });
    });
  }
});

describe("SCN-KR-042 round trip", () => {
  for (const c of cases.filter((x) => x.scn === "SCN-KR-042")) {
    it(`SCN-KR-042 formatRef(parseRef(s)) = s: ${c.name}`, () => {
      const s = c.args()[0] as string;
      const parsed = kernel.parseRef(s);
      assert.ok(parsed.ok);
      assert.deepEqual(kernel.formatRef(parsed.value.id, parsed.value.version), { ok: true, value: s });
    });
  }
});

const META_TEXT =
  '{"schema":{"properties":{"card":{"items":{"type":"string"},"type":"array"},"extends":{"pinned":true,"ref":"core/type","type":"string"},"schema":{"type":"schema"},"unique":{"items":{"type":"string"},"type":"array"}},"required":["schema"],"type":"object"}}';

/** True when the value and every object and array reachable from it are frozen. */
function deepFrozen(root: unknown): boolean {
  const stack: unknown[] = [root];
  const seen = new Set<object>();
  while (stack.length > 0) {
    const v = stack.pop();
    if (typeof v !== "object" || v === null || seen.has(v)) continue;
    seen.add(v);
    if (!Object.isFrozen(v)) return false;
    for (const k of Object.keys(v)) stack.push((v as Record<string, unknown>)[k]);
  }
  return true;
}

describe("SCN-KR-054 the meta-type is typed by itself", () => {
  it("SCN-KR-054 ref, canonical body, self-admission, typeOf, frozen", () => {
    assert.equal(kernel.metaType.ref, "core/type@1");
    assert.deepEqual(kernel.canonical(kernel.metaType.body), { ok: true, value: META_TEXT });
    const a = kernel.admit(META_TEXT, kernel.metaType);
    assert.ok(a.ok, JSON.stringify(a));
    assert.equal(a.value.type, "core/type@1");
    assert.deepEqual(a.value.body, kernel.metaType.body);
    const envelope = '{"body":' + META_TEXT + ',"type":"core/type@1"}';
    assert.equal(a.value.hash, "sha256:" + createHash("sha256").update(envelope, "utf8").digest("hex"));
    const t = kernel.typeOf([typeRecord("core/type", 1, kernel.metaType.body)]);
    assert.ok(t.ok, JSON.stringify(t));
    assert.equal(t.value.ref, "core/type@1");
    assert.ok(deepFrozen(kernel.metaType));
  });

  it("SCN-KR-054 a type made from the meta-type admits a type body", () => {
    const t = mustType([typeRecord("core/type", 1, kernel.metaType.body)]);
    assert.ok(kernel.admit('{"schema":{"type":"object","properties":{}}}', t).ok);
  });
});

/** Content snapshot through property descriptors: getters are not called; iterative for deep values. */
function snapshot(root: unknown): string {
  const ids = new Map<unknown, number>();
  const queue: object[] = [];
  const out: string[] = [];
  const proto = (p: unknown): string =>
    p === null ? "null" : p === Object.prototype ? "Object" : p === Array.prototype ? "Array" : "other";
  const repr = (v: unknown): string => {
    if (typeof v === "function") return "fn";
    if (typeof v === "object" && v !== null) {
      if (!ids.has(v)) {
        ids.set(v, ids.size);
        queue.push(v);
      }
      return "#" + String(ids.get(v));
    }
    if (typeof v === "number") return Object.is(v, -0) ? "n:-0" : "n:" + String(v);
    if (typeof v === "symbol") return "s:" + String(v.description);
    return typeof v + ":" + String(v);
  };
  out.push(repr(root));
  for (let i = 0; i < queue.length; i++) {
    const o = queue[i] as object;
    out.push("@" + String(ids.get(o)) + " " + proto(Object.getPrototypeOf(o)) + " ext:" + String(Object.isExtensible(o)));
    for (const k of Reflect.ownKeys(o)) {
      const d = Object.getOwnPropertyDescriptor(o, k) as PropertyDescriptor;
      const flags = `e${String(d.enumerable)}c${String(d.configurable)}`;
      const body = "value" in d ? `=${repr(d.value)}w${String(d.writable)}` : "=accessor";
      out.push(`  ${typeof k === "symbol" ? "sym:" + String(k.description) : k}${body}${flags}`);
    }
  }
  return out.join("\n");
}

/** The calls of the scenarios above that are not cases of vectors.ts, so the purity sweep covers them too. */
function contractCases(): Case[] {
  const out: Case[] = [];
  const i = fixture.section_3_2_2.input;
  out.push({
    scn: "SCN-KR-037",
    name: "section 3.2.2",
    fn: "canonical",
    args: () => [{ numbers: i.numbers, string: String.fromCodePoint(...i.string_code_points), literals: i.literals }],
  });
  out.push({
    scn: "SCN-KR-037",
    name: "section 3.2.3",
    fn: "canonical",
    args: () => [Object.fromEntries(fixture.section_3_2_3.members.map(([k, v]) => [String.fromCodePoint(...k), v]))],
  });
  for (const [bits, expected] of fixture.appendix_b.vectors) {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, BigInt("0x" + bits));
    const x = view.getFloat64(0);
    out.push({ scn: "SCN-KR-037", name: "appendix B " + bits, fn: "canonical", args: () => [x], ...(expected === null ? { errors: [{ code: "not-json", path: "" }] } : {}) });
  }
  fixture.nfc.vectors.forEach(([input, nfc], k) => {
    for (const s of [String.fromCodePoint(...input), String.fromCodePoint(...nfc)]) {
      out.push({ scn: "SCN-KR-041", name: "NFC vector " + String(k), fn: "admit", args: () => [JSON.stringify({ s }), T_S] });
    }
  });
  for (const c of cases.filter((x) => x.scn === "SCN-KR-042")) {
    const parsed = kernel.parseRef(c.args()[0]);
    if (parsed.ok) out.push({ scn: "SCN-KR-042", name: "formatRef " + c.name, fn: "formatRef", args: () => [parsed.value.id, parsed.value.version] });
  }
  out.push({ scn: "SCN-KR-054", name: "self-admission", fn: "admit", args: () => [META_TEXT, kernel.metaType] });
  out.push({ scn: "SCN-KR-054", name: "typeOf of the meta record", fn: "typeOf", args: () => [[typeRecord("core/type", 1, kernel.metaType.body)]] });
  return out;
}

const MADE = new Set(["admit", "typeOf", "entity", "event"]);

describe("SCN-KR-026 refusals are values, functions are pure", () => {
  for (const c of [...cases, ...chainCases, ...deepCases, ...contractCases()]) {
    it(`SCN-KR-026 ${c.fn} twice, arguments unchanged: ${c.scn} ${c.name}`, () => {
      const fn = kernel[c.fn] as (...args: unknown[]) => unknown;
      const args = c.args();
      const before = args.map(snapshot);
      let first: unknown;
      let second: unknown;
      assert.doesNotThrow(() => {
        first = fn(...args);
        second = fn(...args);
      });
      assert.deepEqual(first, second);
      // The snapshot holds the extensibility and the writable / configurable flags: an argument frozen by the call
      // differs from its snapshot.
      assert.deepEqual(args.map(snapshot), before);
      const res = first as { ok: boolean; value?: unknown; errors?: unknown[] };
      if (c.errors !== undefined) {
        assert.equal(res.ok, false);
        assert.ok(Array.isArray(res.errors) && res.errors.length > 0);
      } else if (res.ok && MADE.has(c.fn)) {
        assert.ok(deepFrozen(res.value), "the value is not deeply frozen");
      }
    });
  }

  it("SCN-KR-026 metaType is deeply frozen", () => {
    assert.ok(deepFrozen(kernel.metaType));
  });
});

