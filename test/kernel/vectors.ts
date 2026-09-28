// Vectors of format v1 (REQ-KR-001): inputs and expected results of the kernel scenarios. Scenario tests assert
// them; SCN-KR-001 calls every function with every input of its scenarios twice and checks purity.
// JSON escape sequences are built by `esc`, code points by `cp`: the source holds no escape literals.

import type { Refusal } from "../../src/kernel/index.ts";
import * as kernel from "../../src/kernel/index.ts";

export type KernelFn = Exclude<keyof typeof kernel, never>;

export type Case = {
  readonly scn: string;
  readonly name: string;
  readonly fn: KernelFn;
  /** Fresh arguments for every call. */
  readonly args: () => unknown[];
  /** Expected refusals, exactly and in order. */
  readonly errors?: readonly Refusal[];
  /** Expected success value (deep strict equality). */
  readonly value?: unknown;
  /** Extra assertions on a success value. */
  readonly check?: (value: unknown) => void;
};

const BS = String.fromCharCode(92);
/** JSON escape sequence `\uXXXX` as text. */
export const esc = (hex: string): string => BS + "u" + hex;
export const cp = (...points: number[]): string => String.fromCodePoint(...points);
export const nested = (n: number): string => "[".repeat(n) + "]".repeat(n);
const r = (code: string, path: string): Refusal => ({ code, path });
const zeros = (n: number): string => "/0".repeat(n);

export const ULID = "01J8ZQ4N7X5K2M9R3T6V8W0Y1A";
// The vector `warrant/REQ-` + `KRN-011` of SCN-KR-010, built so the id check does not read it as a spec id.
const NOT_AN_ID_REF = "warrant/REQ-" + "KRN-011";
export const VALID_INPUT = (): Record<string, unknown> => ({
  id: "warrant/" + ULID,
  type: "std/domain@1",
  version: 3,
  by: "warrant/SES-01J8ZQ3",
  body: { name: "lifecycle" },
});

const input = (scn: string, name: string, text: unknown, expect: Pick<Case, "errors" | "value" | "check">): Case => ({
  scn,
  name,
  fn: "checkInput",
  args: () => [text],
  ...expect,
});

const bodyOf = (text: string): unknown => {
  const res = kernel.checkInput(text);
  if (!res.ok) throw new Error("vector text must pass checkInput: " + text);
  return res.value;
};

const selfRef = (): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  o["s"] = o;
  return o;
};

export const cases: Case[] = [
  // SCN-KR-003 — numbers on the boundaries
  ...(
    [
      ["9007199254740991", 9007199254740991],
      ["-9007199254740991", -9007199254740991],
      ["1.0", 1],
      ["0.5", 0.5],
      ["1e-300", 1e-300],
      ["2e0", 2],
      ["1e-400", 0],
    ] as const
  ).map(([t, v]) => input("SCN-KR-003", t, t, { value: v })),
  ...["9007199254740992", "9007199254740993", "-9007199254740992", "1e300", "1.7976931348623157e308"].map((t) =>
    input("SCN-KR-003", t, t, { errors: [r("unsafe-integer", "")] }),
  ),
  ...["-0", "-0.0", "-1e-400"].map((t) => input("SCN-KR-003", t, t, { errors: [r("negative-zero", "")] })),
  ...["1e400", "-1e400", "1.7976931348623159e308"].map((t) =>
    input("SCN-KR-003", t, t, { errors: [r("non-finite", "")] }),
  ),

  // SCN-KR-002 — NFC and an ordinary __proto__ key
  input("SCN-KR-002", "NFC of keys and values, __proto__ member", '{"e' + esc("0301") + '": "cafe' + esc("0301") + '", "__proto__": {"a": 1}}', {
    check: (v) => {
      const o = v as Record<string, unknown>;
      if (Object.getPrototypeOf(o) !== Object.prototype) throw new Error("prototype changed");
      const keys = Object.keys(o);
      if (keys.length !== 2 || keys[0] !== cp(0xe9) || keys[1] !== "__proto__") throw new Error("keys " + keys.join(","));
      if (o[cp(0xe9)] !== "caf" + cp(0xe9)) throw new Error("value not NFC");
      const proto = Object.getOwnPropertyDescriptor(o, "__proto__");
      if (proto === undefined || JSON.stringify(proto.value) !== '{"a":1}') throw new Error("__proto__ member");
    },
  }),

  // SCN-KR-004 — structural refusals with a place
  input("SCN-KR-004", "duplicate key", '{"a":1,"a":2}', { errors: [r("duplicate-key", "/a")] }),
  input("SCN-KR-004", "duplicate key after NFC", '{"' + esc("00e9") + '":1,"e' + esc("0301") + '":2}', {
    errors: [r("duplicate-key", "/" + cp(0xe9))],
  }),
  input("SCN-KR-004", "escaped lone surrogate", '{"s":"' + esc("d800") + '"}', { errors: [r("lone-surrogate", "/s")] }),
  input("SCN-KR-004", "raw lone surrogate", '{"s":"' + String.fromCharCode(0xdc00) + '"}', {
    errors: [r("lone-surrogate", "/s")],
  }),
  input("SCN-KR-004", "$enc", '{"x":[{"$enc":"q"}]}', { errors: [r("reserved-enc", "/x/0")] }),
  input("SCN-KR-004", "$ref with another key", '{"r":{"$ref":"std/need@2","k":1}}', { errors: [r("bad-ref", "/r")] }),
  input("SCN-KR-004", "$ref not a string", '{"r":{"$ref":5}}', { errors: [r("bad-ref", "/r")] }),
  input("SCN-KR-004", "$ref reserved scheme", '{"r":{"$ref":"#g1:ab"}}', { errors: [r("bad-ref", "/r")] }),
  input("SCN-KR-004", "trailing comma", "[1,]", { errors: [r("syntax", "")] }),
  input("SCN-KR-004", "byte order mark", cp(0xfeff) + "{}", { errors: [r("syntax", "")] }),
  input("SCN-KR-004", "text after value", "{} x", { errors: [r("syntax", "")] }),
  input("SCN-KR-004", "refusals in text order", '{"a":-0,"b":{"$enc":1},"a":2}', {
    errors: [r("negative-zero", "/a"), r("reserved-enc", "/b"), r("duplicate-key", "/a")],
  }),

  // SCN-KR-005 — depth limit
  input("SCN-KR-005", "64 levels", nested(64), {
    check: (v) => {
      let x = v;
      for (let i = 0; i < 63; i++) x = (x as unknown[])[0];
      if (!Array.isArray(x) || x.length !== 0) throw new Error("depth 64 value");
    },
  }),
  input("SCN-KR-005", "65 levels", nested(65), { errors: [r("too-deep", zeros(64))] }),
  input("SCN-KR-005", "100 000 open brackets", "[".repeat(100000), { errors: [r("too-deep", zeros(64))] }),

  // SCN-KR-016 — refusal that stops parsing
  input("SCN-KR-016", "too-deep drops earlier refusals", "[-0," + nested(64) + "]", {
    errors: [r("too-deep", "/1" + zeros(63))],
  }),
  input("SCN-KR-016", "too-deep before extra bracket", nested(65) + "]", { errors: [r("too-deep", zeros(64))] }),
  input("SCN-KR-016", "unclosed", "[[[", { errors: [r("syntax", "")] }),
  input("SCN-KR-016", "syntax drops negative-zero", "[-0", { errors: [r("syntax", "")] }),

  // SCN-KR-017 — places of object-level refusals, pointer escaping
  input("SCN-KR-017", "negative zero then $enc", '{"a":-0,"$enc":1}', {
    errors: [r("negative-zero", "/a"), r("reserved-enc", "")],
  }),
  input("SCN-KR-017", "duplicate then its value", '{"a":1,"a":-0}', {
    errors: [r("duplicate-key", "/a"), r("negative-zero", "/a")],
  }),
  input("SCN-KR-017", "inside $enc object", '{"$enc":{"x":-0}}', {
    errors: [r("reserved-enc", ""), r("negative-zero", "/$enc/x")],
  }),
  input("SCN-KR-017", "inside bad $ref object", '{"r":{"$ref":5,"k":{"$enc":1}}}', {
    errors: [r("bad-ref", "/r"), r("reserved-enc", "/r/k")],
  }),
  input("SCN-KR-017", "slash escaped", '{"a/b":1,"a/b":2}', { errors: [r("duplicate-key", "/a~1b")] }),
  input("SCN-KR-017", "tilde escaped", '{"m~n":-0}', { errors: [r("negative-zero", "/m~0n")] }),
  input("SCN-KR-017", "third duplicate", '{"a":1,"a":2,"a":3}', {
    errors: [r("duplicate-key", "/a"), r("duplicate-key", "/a")],
  }),
  input("SCN-KR-017", "duplicate $ref", '{"$ref":"a/b","$ref":5}', { errors: [r("duplicate-key", "/$ref")] }),
  input("SCN-KR-017", "refused key", '{"k' + esc("d800") + '":-0}', { errors: [r("lone-surrogate", "")] }),
  input("SCN-KR-017", "too deep under refused key", '{"k' + esc("d800") + '":' + nested(64) + "}", {
    errors: [r("too-deep", "")],
  }),
  input("SCN-KR-017", "$ref value refused", '{"$ref":"' + esc("d800") + '"}', {
    errors: [r("bad-ref", ""), r("lone-surrogate", "/$ref")],
  }),

  // SCN-KR-018 — checks on the NFC form, surrogate pairs
  input("SCN-KR-018", "Kelvin sign", '{"$ref":"warrant/' + cp(0x212a) + 'ey"}', { value: { $ref: "warrant/Key" } }),
  input("SCN-KR-018", "escape and raw unit pair", '{"s":"' + esc("d83d") + String.fromCharCode(0xde00) + '"}', {
    value: { s: cp(0x1f600) },
  }),
  input("SCN-KR-018", "escaped pair", '{"s":"' + esc("d83d") + esc("de00") + '"}', { value: { s: cp(0x1f600) } }),
  input("SCN-KR-018", "reversed pair", '{"s":"' + esc("de00") + esc("d83d") + '"}', {
    errors: [r("lone-surrogate", "/s")],
  }),

  // SCN-KR-023 — code points outside Unicode 16.0
  ...[0x378, 0xffff, 0xfdd0, 0x323b0, 0xe0080, 0x10ffff].map((c) =>
    input("SCN-KR-023", "U+" + c.toString(16).toUpperCase(), '{"s":"' + cp(c) + '"}', {
      errors: [r("unassigned", "/s")],
    }),
  ),
  ...[0xe000, 0xf0000, 0x1c89].map((c) =>
    input("SCN-KR-023", "U+" + c.toString(16).toUpperCase(), '{"s":"' + cp(c) + '"}', { value: { s: cp(c) } }),
  ),
  input("SCN-KR-023", "unassigned key", '{"k' + cp(0x378) + '":1}', { errors: [r("unassigned", "")] }),
  input("SCN-KR-023", "lone surrogate first", '{"s":"' + cp(0x378) + esc("d800") + '"}', {
    errors: [r("lone-surrogate", "/s")],
  }),

  // SCN-KR-007 — not a JSON value
  ...(
    [
      ["undefined in array", () => ({ a: [1, undefined] }), "/a/1"],
      ["bigint", () => ({ b: 1n }), "/b"],
      ["Date", () => ({ c: new Date(0) }), "/c"],
      ["hole", () => [1, , 3], "/1"],
      ["cycle", selfRef, "/s"],
      ["lone surrogate", () => String.fromCharCode(0xd800), ""],
    ] as const
  ).map(
    ([name, make, path]): Case => ({
      scn: "SCN-KR-007",
      name,
      fn: "canonical",
      args: () => [make()],
      errors: [r("not-json", path)],
    }),
  ),
  { scn: "SCN-KR-007", name: "-0", fn: "canonical", args: () => [-0], value: "0" },

  // SCN-KR-019 — walk order, shared subobject, kinds of properties
  ...(
    [
      ["canonical key order", () => ({ b: undefined, a: undefined }), "/a"],
      [
        "getter not called",
        () => {
          const o = {};
          Object.defineProperty(o, "g", { enumerable: true, get: () => { throw new Error("getter called"); } });
          return o;
        },
        "/g",
      ],
      ["symbol key", () => ({ [Symbol("k")]: 1 }), ""],
      [
        "non-enumerable property",
        () => {
          const o = { v: 1 };
          Object.defineProperty(o, "n", { value: 1, enumerable: false });
          return o;
        },
        "/n",
      ],
      [
        "array property",
        () => {
          const a: unknown[] = [1];
          (a as unknown as Record<string, unknown>)["p"] = 1;
          return a;
        },
        "/p",
      ],
      [
        "non-member before member",
        () => {
          const o = { z: undefined };
          Object.defineProperty(o, "a", { value: 1, enumerable: false });
          return o;
        },
        "/a",
      ],
      ["symbol before members", () => ({ a: undefined, [Symbol("k")]: 1 }), ""],
      ["array with null prototype", () => ({ v: Object.setPrototypeOf([1], null) }), "/v"],
      [
        "non-enumerable index",
        () => {
          const a = [1, 2];
          Object.defineProperty(a, "1", { value: 2, enumerable: false });
          return a;
        },
        "/1",
      ],
    ] as const
  ).map(
    ([name, make, path]): Case => ({
      scn: "SCN-KR-019",
      name,
      fn: "canonical",
      args: () => [make()],
      errors: [r("not-json", path)],
    }),
  ),
  {
    scn: "SCN-KR-019",
    name: "shared subobject is not a cycle",
    fn: "canonical",
    args: () => {
      const x = {};
      return [{ a: x, b: x }];
    },
    value: '{"a":{},"b":{}}',
  },

  // SCN-KR-008 — hash is sha256 of the canonical form
  {
    scn: "SCN-KR-008",
    name: "hash",
    fn: "hash",
    args: () => ["std/domain", { name: "lifecycle", code: "LCY" }],
    value: "a4ab98af0a7f2bf7899d59506cd69fb5aab77c4e292679dc1f1a28ddcf251fe4",
  },
  {
    scn: "SCN-KR-008",
    name: "hash, other key order",
    fn: "hash",
    args: () => ["std/domain", { code: "LCY", name: "lifecycle" }],
    value: "a4ab98af0a7f2bf7899d59506cd69fb5aab77c4e292679dc1f1a28ddcf251fe4",
  },
  {
    scn: "SCN-KR-008",
    name: "valueId",
    fn: "valueId",
    args: () => ["std/domain", { name: "lifecycle", code: "LCY" }],
    value: "#a4ab98af0a7f2bf7899d59506cd69fb5",
  },

  // SCN-KR-009 — hash refusals
  ...["std/domain@1", "#3fa29c0d71be44a2b6c1d0e9f8a7b6c5", "domain", "#g1:ab"].map(
    (t): Case => ({ scn: "SCN-KR-009", name: "typeId " + t, fn: "hash", args: () => [t, {}], errors: [r("bad-type-id", "/typeId")] }),
  ),
  { scn: "SCN-KR-009", name: "body NaN", fn: "hash", args: () => ["std/domain", { x: NaN }], errors: [r("not-json", "/body/x")] },
  { scn: "SCN-KR-009", name: "valueId typeId", fn: "valueId", args: () => ["std/domain@1", {}], errors: [r("bad-type-id", "/typeId")] },
  { scn: "SCN-KR-009", name: "valueId body", fn: "valueId", args: () => ["std/x", { x: NaN }], errors: [r("not-json", "/body/x")] },

  // SCN-KR-010 — valid references, round trip (formatRef is checked by the scenario test)
  ...(
    [
      ["std/need@2", { id: "std/need", version: 2 }],
      [NOT_AN_ID_REF, { id: NOT_AN_ID_REF }],
      ["core/rule.type-shape@1", { id: "core/rule.type-shape", version: 1 }],
      ["acme.tools/x_1", { id: "acme.tools/x_1" }],
      ["warrant/" + ULID, { id: "warrant/" + ULID }],
      ["#3fa29c0d71be44a2b6c1d0e9f8a7b6c5", { id: "#3fa29c0d71be44a2b6c1d0e9f8a7b6c5" }],
      ["#3fa29c0d71be44a2b6c1d0e9f8a7b6c5@1", { id: "#3fa29c0d71be44a2b6c1d0e9f8a7b6c5", version: 1 }],
      ["warrant/x@9007199254740991", { id: "warrant/x", version: 9007199254740991 }],
      ["warrant/" + "a".repeat(128), { id: "warrant/" + "a".repeat(128) }],
      ["a".repeat(64) + "/x", { id: "a".repeat(64) + "/x" }],
    ] as const
  ).map(([s, v]): Case => ({ scn: "SCN-KR-010", name: s.slice(0, 40), fn: "parseRef", args: () => [s], value: v })),

  // SCN-KR-011 — invalid references
  ...["#g1:abcd", "#z:1", "#g1:ab@2", "#g1:ab@0"].map(
    (s): Case => ({ scn: "SCN-KR-011", name: s, fn: "parseRef", args: () => [s], errors: [r("reserved-scheme", "")] }),
  ),
  ...[
    "#3FA29C0D71BE44A2B6C1D0E9F8A7B6C5",
    "#3fa29c0d71be44a2b6c1d0e9f8a7b6c",
    "warrant/",
    "Warrant/x",
    "warrant/a b",
    "warrant/a/b",
    "warrant/-x",
    "warrant/x@0",
    "warrant/x@01",
    "warrant/x@9007199254740992",
    "warrant/x@",
    "std/need@2@3",
    "",
    "warrant/" + "a".repeat(129),
    "#z:",
    "#z:xyz",
    "acme./x",
    "acme..tools/x",
    "#G1:ab",
    "a".repeat(65) + "/x",
  ].map((s): Case => ({ scn: "SCN-KR-011", name: "bad " + s.slice(0, 40), fn: "parseRef", args: () => [s], errors: [r("bad-ref", "")] })),
  { scn: "SCN-KR-011", name: "formatRef version 0", fn: "formatRef", args: () => ["warrant/x", 0], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-011", name: "formatRef version 1.5", fn: "formatRef", args: () => ["warrant/x", 1.5], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-011", name: "formatRef bad id", fn: "formatRef", args: () => ["Warrant/x"], errors: [r("bad-id", "/id")] },
  { scn: "SCN-KR-011", name: "formatRef reserved", fn: "formatRef", args: () => ["#g1:ab"], errors: [r("reserved-scheme", "/id")] },

  // SCN-KR-012 — new id from a ULID
  { scn: "SCN-KR-012", name: "valid", fn: "newId", args: () => ["warrant", ULID], value: "warrant/" + ULID },
  { scn: "SCN-KR-012", name: "bad namespace", fn: "newId", args: () => ["Warrant", ULID], errors: [r("bad-namespace", "/namespace")] },
  ...["01j8zq4n7x5k2m9r3t6v8w0y1a", "81J8ZQ4N7X5K2M9R3T6V8W0Y1A", "01J8ZQ4N7X5K2M9R3T6V8W0Y1", "01J8ZQ4N7X5K2M9R3T6V8W0YIL"].map(
    (u): Case => ({ scn: "SCN-KR-012", name: "bad ulid " + u, fn: "newId", args: () => ["warrant", u], errors: [r("bad-ulid", "/ulid")] }),
  ),
  { scn: "SCN-KR-012", name: "namespace of 64", fn: "newId", args: () => ["a".repeat(64), ULID], value: "a".repeat(64) + "/" + ULID },
  { scn: "SCN-KR-012", name: "namespace of 65", fn: "newId", args: () => ["a".repeat(65), ULID], errors: [r("bad-namespace", "/namespace")] },

  // SCN-KR-013 — references in a body
  {
    scn: "SCN-KR-013",
    name: "walk order, first appearance",
    fn: "refsOf",
    args: () => [bodyOf('{"b": [{"$ref": "std/need@2"}, {"x": {"$ref": "warrant/REQ-1"}}], "a": {"$ref": "warrant/REQ-1"}, "c": "$ref"}')],
    value: [{ id: "warrant/REQ-1" }, { id: "std/need", version: 2 }],
  },
  { scn: "SCN-KR-013", name: "body itself", fn: "refsOf", args: () => [bodyOf('{"$ref": "core/type@1"}')], value: [{ id: "core/type", version: 1 }] },
  { scn: "SCN-KR-013", name: "no references", fn: "refsOf", args: () => [bodyOf('[1, "a", null]')], value: [] },

  // SCN-KR-022 — refusals of refsOf
  { scn: "SCN-KR-022", name: "$ref not a string", fn: "refsOf", args: () => [{ $ref: 5 }], errors: [r("bad-ref", "")] },
  {
    scn: "SCN-KR-022",
    name: "walk order",
    fn: "refsOf",
    args: () => [{ y: { $ref: "x/y", k: 1 }, x: { $ref: "a" } }],
    errors: [r("bad-ref", "/x"), r("bad-ref", "/y")],
  },
  { scn: "SCN-KR-022", name: "cycle", fn: "refsOf", args: () => [selfRef()], errors: [r("not-json", "/s")] },
  { scn: "SCN-KR-022", name: "no NFC", fn: "refsOf", args: () => [{ $ref: "warrant/" + cp(0x212a) + "ey" }], errors: [r("bad-ref", "")] },
  { scn: "SCN-KR-022", name: "not-json alone", fn: "refsOf", args: () => [{ a: { $ref: 5 }, b: undefined }], errors: [r("not-json", "/b")] },
  {
    scn: "SCN-KR-022",
    name: "object before members",
    fn: "refsOf",
    args: () => [{ $ref: "a/b", k: { $ref: 5 } }],
    errors: [r("bad-ref", ""), r("bad-ref", "/k")],
  },

  // SCN-KR-014 — revision (key order and body identity are checked by the scenario test)
  {
    scn: "SCN-KR-014",
    name: "revision",
    fn: "revision",
    args: () => [VALID_INPUT(), 1790451612345],
    value: {
      id: "warrant/" + ULID,
      type: "std/domain@1",
      version: 3,
      at: "2026-09-26T19:40:12.345Z",
      by: "warrant/SES-01J8ZQ3",
      body: { name: "lifecycle" },
    },
  },

  // SCN-KR-015 — revision refusals
  {
    scn: "SCN-KR-015",
    name: "all fields",
    fn: "revision",
    args: () => [{ id: "warrant/x", type: "std/domain", version: 0, by: "warrant/SES-1@2", body: {} }, -1],
    errors: [r("bad-type", "/input/type"), r("bad-version", "/input/version"), r("bad-by", "/input/by"), r("bad-at", "/at")],
  },
  { scn: "SCN-KR-015", name: "at after 9999", fn: "revision", args: () => [VALID_INPUT(), 253402300800000], errors: [r("bad-at", "/at")] },
  { scn: "SCN-KR-015", name: "at fractional", fn: "revision", args: () => [VALID_INPUT(), 1.5], errors: [r("bad-at", "/at")] },
  {
    scn: "SCN-KR-015",
    name: "extra key and no body",
    fn: "revision",
    args: () => {
      const i = VALID_INPUT();
      delete i["body"];
      i["extra"] = 1;
      return [i, 0];
    },
    errors: [r("bad-input", "/input/extra"), r("bad-body", "/input/body")],
  },
  { scn: "SCN-KR-015", name: "reserved id", fn: "revision", args: () => [{ ...VALID_INPUT(), id: "#g1:ab" }, 0], errors: [r("reserved-scheme", "/input/id")] },
  { scn: "SCN-KR-015", name: "reserved by", fn: "revision", args: () => [{ ...VALID_INPUT(), by: "#g1:ab" }, 0], errors: [r("bad-by", "/input/by")] },
  {
    scn: "SCN-KR-015",
    name: "id getter not called",
    fn: "revision",
    args: () => {
      const i = VALID_INPUT();
      Object.defineProperty(i, "id", { enumerable: true, get: () => { throw new Error("getter called"); } });
      return [i, 0];
    },
    errors: [r("bad-id", "/input/id")],
  },

  // SCN-KR-020 — arguments of a wrong type
  { scn: "SCN-KR-020", name: "checkInput(123)", fn: "checkInput", args: () => [123], errors: [r("syntax", "")] },
  { scn: "SCN-KR-020", name: "parseRef(null)", fn: "parseRef", args: () => [null], errors: [r("bad-ref", "")] },
  { scn: "SCN-KR-020", name: "formatRef(5)", fn: "formatRef", args: () => [5], errors: [r("bad-id", "/id")] },
  { scn: "SCN-KR-020", name: "formatRef version string", fn: "formatRef", args: () => ["warrant/x", "1"], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-020", name: "formatRef version null", fn: "formatRef", args: () => ["warrant/x", null], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-020", name: "newId(1, …)", fn: "newId", args: () => [1, ULID], errors: [r("bad-namespace", "/namespace")] },
  { scn: "SCN-KR-020", name: "hash(5, {})", fn: "hash", args: () => [5, {}], errors: [r("bad-type-id", "/typeId")] },
  { scn: "SCN-KR-020", name: "valueId(5, {})", fn: "valueId", args: () => [5, {}], errors: [r("bad-type-id", "/typeId")] },
  { scn: "SCN-KR-020", name: "revision(null, 0)", fn: "revision", args: () => [null, 0], errors: [r("bad-input", "/input")] },
  { scn: "SCN-KR-020", name: "revision(null, -1)", fn: "revision", args: () => [null, -1], errors: [r("bad-input", "/input"), r("bad-at", "/at")] },

  // SCN-KR-021 — refusals of several parameters, in parameter order
  { scn: "SCN-KR-021", name: "hash", fn: "hash", args: () => ["domain", { x: NaN }], errors: [r("bad-type-id", "/typeId"), r("not-json", "/body/x")] },
  { scn: "SCN-KR-021", name: "formatRef", fn: "formatRef", args: () => ["Warrant/x", 0], errors: [r("bad-id", "/id"), r("bad-version", "/version")] },
  { scn: "SCN-KR-021", name: "newId", fn: "newId", args: () => ["Warrant", "x"], errors: [r("bad-namespace", "/namespace"), r("bad-ulid", "/ulid")] },
];

/** A value of the given depth built in code: each level an array of one element, the deepest one empty. */
export function deepArray(depth: number): unknown[] {
  let v: unknown[] = [];
  for (let i = 1; i < depth; i++) v = [v];
  return v;
}

// SCN-KR-024 — deep value built in code (also part of the SCN-KR-001 purity check).
export const deepCases: Case[] = [
  { scn: "SCN-KR-024", name: "canonical", fn: "canonical", args: () => [deepArray(100000)], value: "[".repeat(100000) + "]".repeat(100000) },
  { scn: "SCN-KR-024", name: "refsOf", fn: "refsOf", args: () => [deepArray(100000)], value: [] },
  { scn: "SCN-KR-024", name: "hash", fn: "hash", args: () => ["std/x", deepArray(100000)] },
];
