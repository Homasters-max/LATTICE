// Kernel contract: RFC 8785 vectors (SCN-KR-006), round trip of references (SCN-KR-010), the revision form
// (SCN-KR-014) and purity of every function on every input of its scenarios (SCN-KR-001).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as kernel from "../../src/kernel/index.ts";
import { cases, deepCases, VALID_INPUT } from "./vectors.ts";
import type { Case } from "./vectors.ts";

type Fixture = {
  section_3_2_2: {
    input: { numbers: number[]; string_code_points: number[]; literals: unknown[] };
    expected_utf8_hex: string;
  };
  section_3_2_3: { members: [number[], string][]; expected_key_order: number[][] };
  appendix_b: { vectors: [string, string | null][] };
};

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/jcs-vectors.json", import.meta.url), "utf8"),
) as Fixture;

describe("SCN-KR-006 RFC 8785 vectors", () => {
  it("SCN-KR-006 section 3.2.2: output bytes of 3.2.4", () => {
    const i = fixture.section_3_2_2.input;
    const value = { numbers: i.numbers, string: String.fromCodePoint(...i.string_code_points), literals: i.literals };
    const res = kernel.canonical(value);
    assert.ok(res.ok);
    assert.equal(Buffer.from(res.value, "utf8").toString("hex"), fixture.section_3_2_2.expected_utf8_hex);
  });

  it("SCN-KR-006 section 3.2.3: property sorting", () => {
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
    it(`SCN-KR-006 appendix B: ${bits}`, () => {
      const view = new DataView(new ArrayBuffer(8));
      view.setBigUint64(0, BigInt("0x" + bits));
      const res = kernel.canonical(view.getFloat64(0));
      if (expected === null) assert.deepEqual(res, { ok: false, errors: [{ code: "not-json", path: "" }] });
      else assert.deepEqual(res, { ok: true, value: expected });
    });
  }
});

describe("SCN-KR-010 round trip", () => {
  for (const c of cases.filter((x) => x.scn === "SCN-KR-010")) {
    it(`SCN-KR-010 formatRef(parseRef(s)) = s: ${c.name}`, () => {
      const s = c.args()[0] as string;
      const parsed = kernel.parseRef(s);
      assert.ok(parsed.ok);
      assert.deepEqual(kernel.formatRef(parsed.value.id, parsed.value.version), { ok: true, value: s });
    });
  }
});

describe("SCN-KR-014 revision form", () => {
  it("SCN-KR-014 key order and the same body", () => {
    const input = VALID_INPUT();
    const res = kernel.revision(input, 1790451612345);
    assert.ok(res.ok);
    assert.deepEqual(Object.keys(res.value), ["id", "type", "version", "at", "by", "body"]);
    assert.equal(res.value.body, input["body"]);
    assert.equal(Object.isFrozen(res.value), false);
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

describe("SCN-KR-001 refusal is a value, functions are pure", () => {
  for (const c of [...cases, ...deepCases]) {
    it(`SCN-KR-001 ${c.fn} twice, arguments unchanged: ${c.scn} ${c.name}`, () => {
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
      assert.deepEqual(args.map(snapshot), before);
      const res = first as { ok: boolean; errors?: unknown[] };
      if (c.errors !== undefined) {
        assert.equal(res.ok, false);
        assert.ok(Array.isArray(res.errors) && res.errors.length > 0);
      }
    });
  }
});

export type { Case };
