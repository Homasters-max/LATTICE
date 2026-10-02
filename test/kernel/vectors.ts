// Inputs and expected results of the kernel scenarios (spec `kernel`, REQ-KR-008…018). Scenario tests assert them;
// SCN-KR-026 calls every function with every input twice and checks purity. JSON escape sequences are built by `esc`,
// code points by `cp`: the source holds no escape literals.

import type { Admitted, Refusal, Type } from "../../src/kernel/index.ts";
import * as kernel from "../../src/kernel/index.ts";

/** The functions of the kernel interface. */
export type KernelFn = {
  [K in keyof typeof kernel]: (typeof kernel)[K] extends (...args: never[]) => unknown ? K : never;
}[keyof typeof kernel];

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
  /** Extra assertions on a success value; `args` are the arguments of that call. */
  readonly check?: (value: unknown, args: readonly unknown[]) => void;
};

const BS = String.fromCharCode(92);
/** JSON escape sequence `\uXXXX` as text. */
export const esc = (hex: string): string => BS + "u" + hex;
export const cp = (...points: number[]): string => String.fromCodePoint(...points);
export const nested = (n: number): string => "[".repeat(n) + "]".repeat(n);
const r = (code: string, path: string): Refusal => ({ code, path });
const zeros = (n: number): string => "/0".repeat(n);
const fail = (message: string): never => {
  throw new Error(message);
};

export const ULID = "01J8ZQ4N7X5K2M9R3T6V8W0Y1A";
// The vector `warrant/REQ-` + `KRN-011` of SCN-KR-042, built so the id check does not read it as a spec id.
const NOT_AN_ID_REF = "warrant/REQ-" + "KRN-011";

const selfRef = (): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  o["s"] = o;
  return o;
};

const input = (scn: string, name: string, text: unknown, expect: Pick<Case, "errors" | "value" | "check">): Case => ({
  scn,
  name,
  fn: "checkInput",
  args: () => [text],
  ...expect,
});

// ---- Types of the admission scenarios, made once through the kernel (kernel-made values are known by identity).

export const typeRecord = (id: string, rev: number, body: unknown): Record<string, unknown> => ({
  id,
  rev,
  type: "core/type@1",
  body,
});
const obj = (properties: Record<string, unknown>, required?: string[]): Record<string, unknown> =>
  required === undefined ? { type: "object", properties } : { type: "object", properties, required };
const str = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({ type: "string", ...extra });

export function mustType(chain: unknown[]): Type {
  const t = kernel.typeOf(chain);
  return t.ok ? t.value : fail("type of a vector: " + JSON.stringify(t.errors));
}

export function mustAdmit(text: string, type: Type): Admitted {
  const a = kernel.admit(text, type);
  return a.ok ? a.value : fail("admission of a vector: " + JSON.stringify(a.errors));
}

const DOMAIN = (rev: number): Record<string, unknown> =>
  typeRecord("std/domain", rev, { schema: obj({ code: str(), name: str() }, ["code", "name"]) });
export const T_DOMAIN1 = mustType([DOMAIN(1)]);
export const T_DOMAIN2 = mustType([DOMAIN(2)]);
export const T_S = mustType([typeRecord("test/s", 1, { schema: obj({ s: str() }, ["s"]) })]);

const CHILD_BODY = (): Record<string, unknown> => ({
  extends: "std/knowledge@2",
  schema: obj({ rule: str({ enum: ["must", "should"] }), title: str({ maxLength: 5 }) }, ["rule"]),
});
export const CHILD = (): Record<string, unknown> => typeRecord("lattice/rule", 1, CHILD_BODY());
export const PARENT = (rev = 2): Record<string, unknown> =>
  typeRecord("std/knowledge", rev, {
    schema: obj({ rule: str({ maxLength: 5 }), summary: str(), title: str({ maxLength: 10 }) }, ["title"]),
  });
export const T_RULE = mustType([CHILD(), PARENT()]);

/** A record built in code whose schema key is `e` followed by U+0301 (not NFC). */
export const NFD_RECORD = (): Record<string, unknown> =>
  typeRecord("test/nfd", 1, { schema: obj({ ["e" + cp(0x301)]: { type: "integer" } }) });
export const T_NFD = mustType([NFD_RECORD()]);

export const T_ALL = mustType([
  typeRecord("test/all", 1, {
    schema: obj(
      {
        b: { type: "boolean" },
        e: str({ maxLength: 2, enum: ["ab"] }),
        i: { type: "integer", enum: [1, 2] },
        l: { type: "array", items: { type: "integer" } },
        n: { type: "null" },
        num: { type: "number" },
        o: obj({ x: str() }, ["x"]),
        s: str({ maxLength: 3 }),
      },
      ["b", "s"],
    ),
  }),
]);

export const T_REFS = mustType([
  typeRecord("test/refs", 1, {
    schema: obj({
      any: str({ ref: "std/need" }),
      fl: str({ ref: "std/need", pinned: false }),
      list: { type: "array", items: str({ ref: "std/term", pinned: true }) },
      pin: str({ ref: "std/need", pinned: true }),
    }),
  }),
]);

/** A child that declares a nested object `m` again, narrower and closed (SCN-KR-049). */
export const T_MC = mustType([
  typeRecord("test/mc", 1, { extends: "test/mp@1", schema: obj({ m: obj({ a: str({ maxLength: 2 }) }) }) }),
  typeRecord("test/mp", 1, { schema: obj({ m: obj({ a: str(), b: str() }) }) }),
]);

/** `x` a plain string in the child and a pinned `ref` node in the parent; `y` a `ref` node in both (SCN-KR-053). */
export const T_RC = mustType([
  typeRecord("test/rc", 1, { extends: "test/rp@1", schema: obj({ x: str(), y: str({ ref: "std/a" }) }) }),
  typeRecord("test/rp", 1, { schema: obj({ x: str({ ref: "std/need", pinned: true }), y: str({ ref: "std/b" }) }) }),
]);

export const T_EV = mustType([typeRecord("test/ev", 1, { schema: obj({ of: obj({ a: str(), b: str() }), v: str() }) })]);
export const T_EV2 = mustType([typeRecord("test/ev2", 1, { schema: obj({ of: str() }) })]);

/** Five type records `test/c0@1` … `test/c4@1`, each extending the next; `n` of them, the last without `extends`. */
export function chainOf(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) =>
    typeRecord("test/c" + String(i), 1, {
      ...(i < n - 1 ? { extends: "test/c" + String(i + 1) + "@1" } : {}),
      schema: obj({}),
    }),
  );
}

const admitCase = (scn: string, name: string, text: string, type: () => unknown, expect: Pick<Case, "errors" | "value" | "check">): Case => ({
  scn,
  name,
  fn: "admit",
  args: () => [text, type()],
  ...expect,
});

const hashOf = (expected: string) => (v: unknown): void => {
  const a = v as Admitted;
  if (a.hash !== expected) fail("hash " + a.hash);
};

// ---- Envelope.

export const HEADER = (): Record<string, unknown> => ({
  id: "lattice/domain-lifecycle",
  rev: 3,
  by: "lattice/" + ULID,
  at: 1790451612345,
});
export const EV_HEADER = (): Record<string, unknown> => ({
  id: "lattice/01J8ZQ4N7X5K2M9R3T6V8W0Y1B",
  by: "lattice/" + ULID,
  at: 0,
});
export const A_DOMAIN = (): Admitted => mustAdmit('{"name":"lifecycle","code":"LCY"}', T_DOMAIN1);
export const A_EVENT = (): Admitted => mustAdmit('{"of":{"a":"lattice/x@1","b":"lattice/01H8ZQ4N7X5K2M9R3T6V8W0Y1A"},"v":"pass"}', T_EV);

const H_DOMAIN1 = "sha256:1fc8a412e2a9703d6e71d57a5b1fe958dc2d8947f625b89e512a8dee1a5e2e14";
const H_DOMAIN2 = "sha256:57d33254aa5ae1a3c23d6f838dfd3b958f636af36f30ebba1556412e3cfd1e53";
const H_CAFE = "sha256:aaad863bb5b5ae1342b98cd7557d9c08086132d317206de5d230c502b031864a";

export const cases: Case[] = [
  // SCN-KR-027 — arguments of a wrong type
  { scn: "SCN-KR-027", name: "checkInput(123)", fn: "checkInput", args: () => [123], errors: [r("syntax", "")] },
  { scn: "SCN-KR-027", name: "parseRef(null)", fn: "parseRef", args: () => [null], errors: [r("bad-ref", "")] },
  { scn: "SCN-KR-027", name: "formatRef(5)", fn: "formatRef", args: () => [5], errors: [r("bad-id", "/id")] },
  { scn: "SCN-KR-027", name: "formatRef version string", fn: "formatRef", args: () => ["lattice/x", "1"], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-027", name: "formatRef both", fn: "formatRef", args: () => ["Lattice/x", 0], errors: [r("bad-id", "/id"), r("bad-version", "/version")] },
  { scn: "SCN-KR-027", name: "admit(5, metaType)", fn: "admit", args: () => [5, kernel.metaType], errors: [r("syntax", "/text")] },
  { scn: "SCN-KR-027", name: "admit type null", fn: "admit", args: () => ["{}", null], errors: [r("bad-type", "/type")] },
  { scn: "SCN-KR-027", name: "admit type built in code", fn: "admit", args: () => ["{}", { ref: "core/type@1" }], errors: [r("bad-type", "/type")] },
  { scn: "SCN-KR-027", name: "typeOf(null)", fn: "typeOf", args: () => [null], errors: [r("not-type", "")] },
  { scn: "SCN-KR-027", name: 'formatAt("0")', fn: "formatAt", args: () => ["0"], errors: [r("bad-at", "")] },
  { scn: "SCN-KR-027", name: "entity(null, null)", fn: "entity", args: () => [null, null], errors: [r("bad-header", "/header"), r("bad-admitted", "/admitted")] },
  { scn: "SCN-KR-027", name: "event(undefined, 1)", fn: "event", args: () => [undefined, 1], errors: [r("bad-header", "/header"), r("bad-admitted", "/admitted")] },

  // SCN-KR-028 — NFC, the key __proto__ and keys starting with $
  input("SCN-KR-028", "NFC of keys and values, __proto__ member", '{"e' + esc("0301") + '": "cafe' + esc("0301") + '", "__proto__": {"a": 1}}', {
    check: (v) => {
      const o = v as Record<string, unknown>;
      if (Object.getPrototypeOf(o) !== Object.prototype) fail("prototype changed");
      const keys = Object.keys(o);
      if (keys.length !== 2 || keys[0] !== cp(0xe9) || keys[1] !== "__proto__") fail("keys " + keys.join(","));
      if (o[cp(0xe9)] !== "caf" + cp(0xe9)) fail("value not NFC");
      const proto = Object.getOwnPropertyDescriptor(o, "__proto__");
      if (proto === undefined || JSON.stringify(proto.value) !== '{"a":1}') fail("__proto__ member");
    },
  }),
  input("SCN-KR-028", "$ref and $enc are ordinary members", '{"$ref": 5, "$enc": {"x": 1}}', { value: { $ref: 5, $enc: { x: 1 } } }),

  // SCN-KR-029 — numbers at the limits
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
  ).map(([t, v]) => input("SCN-KR-029", t, t, { value: v })),
  ...["9007199254740992", "9007199254740993", "-9007199254740992", "1e300", "1.7976931348623157e308"].map((t) =>
    input("SCN-KR-029", t, t, { errors: [r("unsafe-integer", "")] }),
  ),
  ...["-0", "-0.0", "-1e-400"].map((t) => input("SCN-KR-029", t, t, { errors: [r("negative-zero", "")] })),
  ...["1e400", "-1e400", "1.7976931348623159e308"].map((t) => input("SCN-KR-029", t, t, { errors: [r("non-finite", "")] })),

  // SCN-KR-030 — structural refusals and their places
  input("SCN-KR-030", "duplicate key", '{"a":1,"a":2}', { errors: [r("duplicate-key", "/a")] }),
  input("SCN-KR-030", "duplicate key after NFC", '{"' + esc("00e9") + '":1,"e' + esc("0301") + '":2}', {
    errors: [r("duplicate-key", "/" + cp(0xe9))],
  }),
  input("SCN-KR-030", "escaped lone surrogate", '{"s":"' + esc("d800") + '"}', { errors: [r("lone-surrogate", "/s")] }),
  input("SCN-KR-030", "raw lone surrogate", '{"s":"' + String.fromCharCode(0xdc00) + '"}', { errors: [r("lone-surrogate", "/s")] }),
  input("SCN-KR-030", "trailing comma", "[1,]", { errors: [r("syntax", "")] }),
  input("SCN-KR-030", "byte order mark", cp(0xfeff) + "{}", { errors: [r("syntax", "")] }),
  input("SCN-KR-030", "text after value", "{} x", { errors: [r("syntax", "")] }),
  input("SCN-KR-030", "refusals in text order", '{"a":-0,"b":{"$enc":1},"a":2}', {
    errors: [r("negative-zero", "/a"), r("duplicate-key", "/a")],
  }),
  input("SCN-KR-030", "$enc and $ref objects admitted", '{"x":[{"$enc":"q"}],"r":{"$ref":"std/need@2","k":1}}', {
    value: { x: [{ $enc: "q" }], r: { $ref: "std/need@2", k: 1 } },
  }),

  // SCN-KR-031 — nesting limit
  input("SCN-KR-031", "64 levels", nested(64), {
    check: (v) => {
      let x = v;
      for (let i = 0; i < 63; i++) x = (x as unknown[])[0];
      if (!Array.isArray(x) || x.length !== 0) fail("depth 64 value");
    },
  }),
  input("SCN-KR-031", "65 levels", nested(65), { errors: [r("too-deep", zeros(64))] }),
  input("SCN-KR-031", "100 000 open brackets", "[".repeat(100000), { errors: [r("too-deep", zeros(64))] }),

  // SCN-KR-032 — refusals that stop the parse
  input("SCN-KR-032", "too-deep drops earlier refusals", "[-0," + nested(64) + "]", { errors: [r("too-deep", "/1" + zeros(63))] }),
  input("SCN-KR-032", "too-deep before extra bracket", nested(65) + "]", { errors: [r("too-deep", zeros(64))] }),
  input("SCN-KR-032", "unclosed", "[[[", { errors: [r("syntax", "")] }),
  input("SCN-KR-032", "syntax drops negative-zero", "[-0", { errors: [r("syntax", "")] }),

  // SCN-KR-033 — places of object-level refusals, escaping of the path
  input("SCN-KR-033", "duplicate then its value", '{"a":1,"a":-0}', { errors: [r("duplicate-key", "/a"), r("negative-zero", "/a")] }),
  input("SCN-KR-033", "inside a $enc member", '{"$enc":{"x":-0}}', { errors: [r("negative-zero", "/$enc/x")] }),
  input("SCN-KR-033", "slash escaped", '{"a/b":1,"a/b":2}', { errors: [r("duplicate-key", "/a~1b")] }),
  input("SCN-KR-033", "tilde escaped", '{"m~n":-0}', { errors: [r("negative-zero", "/m~0n")] }),
  input("SCN-KR-033", "third duplicate", '{"a":1,"a":2,"a":3}', { errors: [r("duplicate-key", "/a"), r("duplicate-key", "/a")] }),
  input("SCN-KR-033", "duplicate $ref", '{"$ref":"a/b","$ref":5}', { errors: [r("duplicate-key", "/$ref")] }),
  input("SCN-KR-033", "refused key", '{"k' + esc("d800") + '":-0}', { errors: [r("lone-surrogate", "")] }),
  input("SCN-KR-033", "too deep under refused key", '{"k' + esc("d800") + '":' + nested(64) + "}", { errors: [r("too-deep", "")] }),
  input("SCN-KR-033", "$ref value refused", '{"$ref":"' + esc("d800") + '"}', { errors: [r("lone-surrogate", "/$ref")] }),

  // SCN-KR-034 — checks on the NFC form, surrogate pairs
  input("SCN-KR-034", "Kelvin sign", '{"s":"warrant/' + cp(0x212a) + 'ey"}', { value: { s: "warrant/Key" } }),
  input("SCN-KR-034", "escape and raw unit pair", '{"s":"' + esc("d83d") + String.fromCharCode(0xde00) + '"}', { value: { s: cp(0x1f600) } }),
  input("SCN-KR-034", "escaped pair", '{"s":"' + esc("d83d") + esc("de00") + '"}', { value: { s: cp(0x1f600) } }),
  input("SCN-KR-034", "reversed pair", '{"s":"' + esc("de00") + esc("d83d") + '"}', { errors: [r("lone-surrogate", "/s")] }),

  // SCN-KR-035 — code points outside Unicode 16.0
  ...[0x378, 0xffff, 0xfdd0, 0x323b0, 0xe0080, 0x10ffff].map((c) =>
    input("SCN-KR-035", "U+" + c.toString(16).toUpperCase(), '{"s":"' + cp(c) + '"}', { errors: [r("unassigned", "/s")] }),
  ),
  ...[0xe000, 0xf0000, 0x1c89].map((c) =>
    input("SCN-KR-035", "U+" + c.toString(16).toUpperCase(), '{"s":"' + cp(c) + '"}', { value: { s: cp(c) } }),
  ),
  input("SCN-KR-035", "unassigned key", '{"k' + cp(0x378) + '":1}', { errors: [r("unassigned", "")] }),
  input("SCN-KR-035", "lone surrogate first", '{"s":"' + cp(0x378) + esc("d800") + '"}', { errors: [r("lone-surrogate", "/s")] }),

  // SCN-KR-038 — not a JSON value
  ...(
    [
      ["undefined in array", () => ({ a: [1, undefined] }), "/a/1"],
      ["bigint", () => ({ b: 1n }), "/b"],
      ["Date", () => ({ c: new Date(0) }), "/c"],
      ["hole", () => [1, , 3], "/1"],
      ["cycle", selfRef, "/s"],
      ["lone surrogate", () => String.fromCharCode(0xd800), ""],
    ] as const
  ).map(([name, make, path]): Case => ({ scn: "SCN-KR-038", name, fn: "canonical", args: () => [make()], errors: [r("not-json", path)] })),
  { scn: "SCN-KR-038", name: "-0", fn: "canonical", args: () => [-0], value: "0" },

  // SCN-KR-039 — walk order, shared sub-object, kinds of properties
  ...(
    [
      ["canonical key order", () => ({ b: undefined, a: undefined }), "/a"],
      [
        "getter not called",
        () => {
          const o = {};
          Object.defineProperty(o, "g", { enumerable: true, get: () => fail("getter called") });
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
  ).map(([name, make, path]): Case => ({ scn: "SCN-KR-039", name, fn: "canonical", args: () => [make()], errors: [r("not-json", path)] })),
  {
    scn: "SCN-KR-039",
    name: "shared sub-object is not a cycle",
    fn: "canonical",
    args: () => {
      const x = {};
      return [{ a: x, b: x }];
    },
    value: '{"a":{},"b":{}}',
  },

  // SCN-KR-042 — valid references (the round trip is checked by contract.test.ts)
  ...(
    [
      ["std/need@2", { id: "std/need", version: 2 }],
      [NOT_AN_ID_REF, { id: NOT_AN_ID_REF }],
      ["core/rule.type-shape@1", { id: "core/rule.type-shape", version: 1 }],
      ["acme.tools/x_1", { id: "acme.tools/x_1" }],
      ["warrant/" + ULID, { id: "warrant/" + ULID }],
      ["warrant/x@9007199254740991", { id: "warrant/x", version: 9007199254740991 }],
      ["warrant/" + "a".repeat(128), { id: "warrant/" + "a".repeat(128) }],
      ["a".repeat(64) + "/x", { id: "a".repeat(64) + "/x" }],
    ] as const
  ).map(([s, v]): Case => ({ scn: "SCN-KR-042", name: s.slice(0, 40), fn: "parseRef", args: () => [s], value: v })),

  // SCN-KR-043 — invalid references
  ...[
    "#3fa29c0d71be44a2b6c1d0e9f8a7b6c5",
    "#3fa29c0d71be44a2b6c1d0e9f8a7b6c5@1",
    "#g1:abcd",
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
    "acme./x",
    "acme..tools/x",
    "a".repeat(65) + "/x",
  ].map((s): Case => ({ scn: "SCN-KR-043", name: "bad " + s.slice(0, 40), fn: "parseRef", args: () => [s], errors: [r("bad-ref", "")] })),
  { scn: "SCN-KR-043", name: "formatRef version 0", fn: "formatRef", args: () => ["warrant/x", 0], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-043", name: "formatRef version 1.5", fn: "formatRef", args: () => ["warrant/x", 1.5], errors: [r("bad-version", "/version")] },
  { scn: "SCN-KR-043", name: "formatRef bad id", fn: "formatRef", args: () => ["Warrant/x"], errors: [r("bad-id", "/id")] },
  { scn: "SCN-KR-043", name: "formatRef value id", fn: "formatRef", args: () => ["#3fa29c0d71be44a2b6c1d0e9f8a7b6c5"], errors: [r("bad-id", "/id")] },

  // SCN-KR-044 — the hash is sha256 of the canonical form over type@n
  ...['{"name":"lifecycle","code":"LCY"}', '{ "code" : "LCY", "name" : "lifecycle" }'].map((t, i) =>
    admitCase("SCN-KR-044", "text " + String(i + 1), t, () => T_DOMAIN1, {
      value: { body: { code: "LCY", name: "lifecycle" }, type: "std/domain@1", hash: H_DOMAIN1, refs: [] },
    }),
  ),

  // SCN-KR-045 — another revision of the type is another hash
  admitCase("SCN-KR-045", "std/domain@2", '{"name":"lifecycle","code":"LCY"}', () => T_DOMAIN2, {
    value: { body: { code: "LCY", name: "lifecycle" }, type: "std/domain@2", hash: H_DOMAIN2, refs: [] },
  }),

  // SCN-KR-046 — equal admitted bodies have equal hashes
  admitCase("SCN-KR-046", "decomposed", '{"name":"cafe' + esc("0301") + '","code":"LCY"}', () => T_DOMAIN1, {
    value: { body: { code: "LCY", name: "caf" + cp(0xe9) }, type: "std/domain@1", hash: H_CAFE, refs: [] },
  }),
  admitCase("SCN-KR-046", "composed", '{"code":"LCY","name":"caf' + esc("00e9") + '"}', () => T_DOMAIN1, {
    value: { body: { code: "LCY", name: "caf" + cp(0xe9) }, type: "std/domain@1", hash: H_CAFE, refs: [] },
  }),
  admitCase("SCN-KR-046", "another body", '{"name":"cafe","code":"LCY"}', () => T_DOMAIN1, {
    check: (v) => {
      if ((v as Admitted).hash === H_CAFE) fail("the same hash for another body");
    },
  }),

  // SCN-KR-047 — body size limit
  admitCase("SCN-KR-047", "1 048 576 bytes", '{"s":"' + "a".repeat(1048568) + '"}', () => T_S, { check: () => undefined }),
  admitCase("SCN-KR-047", "1 048 577 bytes", '{"s":"' + "a".repeat(1048569) + '"}', () => T_S, { errors: [r("too-large", "/text")] }),
  admitCase("SCN-KR-047", "escapes, 1 048 574 bytes", '{"s":"' + esc("20ac").repeat(349522) + '"}', () => T_S, { check: () => undefined }),
  admitCase("SCN-KR-047", "raw, 1 048 580 bytes", '{"s":"' + cp(0x20ac).repeat(349524) + '"}', () => T_S, { errors: [r("too-large", "/text")] }),

  // SCN-KR-048 — stages stop at the first refusal
  admitCase("SCN-KR-048", "parse stops", '{"name":-0}', () => T_DOMAIN1, { errors: [r("negative-zero", "/text/name")] }),
  admitCase("SCN-KR-048", "syntax", "[", () => T_DOMAIN1, { errors: [r("syntax", "/text")] }),
  admitCase("SCN-KR-048", "schema refusals in order", '{"name":5,"x":1}', () => T_DOMAIN1, {
    errors: [r("missing", "/text/code"), r("wrong-type", "/text/name"), r("unknown-field", "/text/x")],
  }),
  admitCase("SCN-KR-048", "type built in code", "[", () => ({ ref: "std/domain@1" }), { errors: [r("bad-type", "/type")] }),
  admitCase("SCN-KR-048", "spread copy of a type", '{"name":"lifecycle","code":"LCY"}', () => ({ ...T_DOMAIN1 }), { errors: [r("bad-type", "/type")] }),
  admitCase("SCN-KR-048", "structuredClone of metaType", '{"name":"lifecycle","code":"LCY"}', () => structuredClone(kernel.metaType), {
    errors: [r("bad-type", "/type")],
  }),

  // SCN-KR-049 — a chain admits the union of its fields and each schema's constraints
  { scn: "SCN-KR-049", name: "typeOf child, parent", fn: "typeOf", args: () => [[CHILD(), PARENT()]], check: (v) => (v as Type).ref === "lattice/rule@1" || fail("ref") },
  admitCase("SCN-KR-049", "valid", '{"title":"abc","rule":"must","summary":"x"}', () => T_RULE, {
    check: (v) => (v as Admitted).type === "lattice/rule@1" || fail("type"),
  }),
  admitCase("SCN-KR-049", "three refusals", '{"title":"abcdefg","rule":"may","extra":1}', () => T_RULE, {
    errors: [r("unknown-field", "/text/extra"), r("not-in-enum", "/text/rule"), r("too-long", "/text/title")],
  }),
  admitCase("SCN-KR-049", "parent's required", '{"rule":"must"}', () => T_RULE, { errors: [r("missing", "/text/title")] }),
  admitCase("SCN-KR-049", "child's required", '{"title":"abc"}', () => T_RULE, { errors: [r("missing", "/text/rule")] }),
  admitCase("SCN-KR-049", "child refuses first", '{"title":"abcdefghijk","rule":"must"}', () => T_RULE, { errors: [r("too-long", "/text/title")] }),
  admitCase("SCN-KR-049", "parent refuses", '{"title":"abc","rule":"should"}', () => T_RULE, { errors: [r("too-long", "/text/rule")] }),
  admitCase("SCN-KR-049", "one refusal across the chain", '{"title":"abc","rule":"mayyyy"}', () => T_RULE, { errors: [r("not-in-enum", "/text/rule")] }),
  {
    scn: "SCN-KR-049",
    name: "schema key not in NFC",
    fn: "typeOf",
    args: () => [[NFD_RECORD()]],
    check: (v, args) => {
      const t = v as Type;
      const props = (t.body["schema"] as Record<string, Record<string, unknown>>)["properties"] as Record<string, unknown>;
      if (Object.keys(props).join() !== cp(0xe9)) fail("type body not NFC");
      const record = (args[0] as Record<string, unknown>[])[0] as Record<string, unknown>;
      if (Object.isFrozen(record) || Object.isFrozen(record["body"])) fail("the argument was frozen");
    },
  },
  admitCase("SCN-KR-049", "NFC key under a schema written in NFD", '{"' + esc("00e9") + '":1}', () => T_NFD, { check: () => undefined }),

  admitCase("SCN-KR-049", "nested: the child refuses", '{"m":{"a":"xyz"}}', () => T_MC, { errors: [r("too-long", "/text/m/a")] }),
  admitCase("SCN-KR-049", "nested: closed by the child node", '{"m":{"b":"x"}}', () => T_MC, { errors: [r("unknown-field", "/text/m/b")] }),
  admitCase("SCN-KR-049", "nested: valid", '{"m":{"a":"xy"}}', () => T_MC, { check: () => undefined }),

  // SCN-KR-050 — malformed chains
  { scn: "SCN-KR-050", name: "empty", fn: "typeOf", args: () => [[]], errors: [r("not-type", "")] },
  { scn: "SCN-KR-050", name: "not an array", fn: "typeOf", args: () => ["x"], errors: [r("not-type", "")] },
  { scn: "SCN-KR-050", name: "parent, child", fn: "typeOf", args: () => [[PARENT(), CHILD()]], errors: [r("bad-extends", "/0/body/extends"), r("bad-extends", "/1/body/extends")] },
  { scn: "SCN-KR-050", name: "child alone", fn: "typeOf", args: () => [[CHILD()]], errors: [r("bad-extends", "/0/body/extends")] },
  { scn: "SCN-KR-050", name: "wrong parent revision", fn: "typeOf", args: () => [[CHILD(), PARENT(1)]], errors: [r("bad-extends", "/0/body/extends")] },
  { scn: "SCN-KR-050", name: "not the meta-type", fn: "typeOf", args: () => [[{ ...CHILD(), type: "core/type@2" }]], errors: [r("not-type", "/0")] },
  {
    scn: "SCN-KR-050",
    name: "schema outside the subset",
    fn: "typeOf",
    args: () => [[typeRecord("test/p", 1, { schema: { type: "object", properties: {}, pattern: "x" } })]],
    errors: [r("not-type", "/0")],
  },
  { scn: "SCN-KR-050", name: "child, not a record", fn: "typeOf", args: () => [[CHILD(), "x"]], errors: [r("not-type", "/1")] },
  { scn: "SCN-KR-050", name: "not a record, parent", fn: "typeOf", args: () => [["x", PARENT()]], errors: [r("not-type", "/0")] },
  {
    scn: "SCN-KR-050",
    name: "accessor at an index",
    fn: "typeOf",
    args: () => {
      const chain: unknown[] = [CHILD(), PARENT()];
      Object.defineProperty(chain, "1", { enumerable: true, get: () => fail("getter called") });
      return [chain];
    },
    errors: [r("not-type", "/1")],
  },
  {
    scn: "SCN-KR-050",
    name: "a type extends a revision of itself",
    fn: "typeOf",
    args: () => {
      const { extends: _, ...unextended } = CHILD_BODY();
      return [[typeRecord("lattice/rule", 2, { ...CHILD_BODY(), extends: "lattice/rule@1" }), typeRecord("lattice/rule", 1, unextended)]];
    },
    errors: [r("bad-extends", "/0/body/extends")],
  },
  { scn: "SCN-KR-050", name: "five records", fn: "typeOf", args: () => [chainOf(5)], check: (v) => (v as Type).ref === "test/c0@1" || fail("ref") },
  { scn: "SCN-KR-050", name: "six records", fn: "typeOf", args: () => [chainOf(6)], errors: [r("chain-too-long", "")] },

  // SCN-KR-051 — a schema outside the subset is refused
  admitCase(
    "SCN-KR-051",
    "schema outside the subset",
    '{"schema":{"type":"object","additionalProperties":false,"required":["a","z"],"properties":{"k":[],"a":{"type":"string","pattern":"x"},"b":{"type":"object"},"c":{"type":"array"},"d":{"type":"string","maxLength":-1},"e":{"type":"date","maxLength":3},"f":{"type":"string","ref":"std/x","maxLength":3},"g":{"type":"string","pinned":true},"h":{"type":"integer","enum":[1,1]},"i":"string","j":{"properties":{}}}}}',
    () => kernel.metaType,
    {
      errors: [
        r("unknown-keyword", "/text/schema/additionalProperties"),
        r("unknown-keyword", "/text/schema/properties/a/pattern"),
        r("bad-keyword", "/text/schema/properties/b/properties"),
        r("bad-keyword", "/text/schema/properties/c/items"),
        r("bad-keyword", "/text/schema/properties/d/maxLength"),
        r("bad-keyword", "/text/schema/properties/e/type"),
        r("bad-keyword", "/text/schema/properties/f/maxLength"),
        r("bad-keyword", "/text/schema/properties/g/pinned"),
        r("bad-keyword", "/text/schema/properties/h/enum"),
        r("bad-keyword", "/text/schema/properties/i"),
        r("bad-keyword", "/text/schema/properties/j/type"),
        r("bad-keyword", "/text/schema/properties/k"),
        r("bad-keyword", "/text/schema/required"),
      ],
    },
  ),

  // SCN-KR-052 — a body against the field types
  admitCase("SCN-KR-052", "valid", '{"b":true,"i":2,"l":[1,2],"n":null,"num":1.5,"o":{"x":"y"},"s":"abc"}', () => T_ALL, { check: () => undefined }),
  admitCase("SCN-KR-052", "maxLength counts code points", '{"b":false,"s":"' + cp(0x1f600).repeat(3) + '"}', () => T_ALL, { check: () => undefined }),
  admitCase("SCN-KR-052", "every field type", '{"b":1,"i":1.5,"l":[1,"2"],"n":0,"num":"1","o":{"y":1},"s":"abcd","t":1}', () => T_ALL, {
    errors: [
      r("wrong-type", "/text/b"),
      r("wrong-type", "/text/i"),
      r("wrong-type", "/text/l/1"),
      r("wrong-type", "/text/n"),
      r("wrong-type", "/text/num"),
      r("missing", "/text/o/x"),
      r("unknown-field", "/text/o/y"),
      r("too-long", "/text/s"),
      r("unknown-field", "/text/t"),
    ],
  }),
  admitCase("SCN-KR-052", "enum", '{"b":false,"i":3,"s":"a"}', () => T_ALL, { errors: [r("not-in-enum", "/text/i")] }),
  admitCase("SCN-KR-052", "not an object", "[]", () => T_ALL, { errors: [r("wrong-type", "/text")] }),
  admitCase("SCN-KR-052", "first check of a node", '{"b":false,"e":"abc","s":"a"}', () => T_ALL, { errors: [r("too-long", "/text/e")] }),

  // SCN-KR-053 — reference fields
  admitCase("SCN-KR-053", "references", '{"pin":"lattice/n1@2","fl":"lattice/n1","any":"lattice/n2@1","list":["lattice/t@1","lattice/t@1"]}', () => T_REFS, {
    check: (v) => {
      const expected = [
        { path: "/any", ref: { id: "lattice/n2", version: 1 }, target: "std/need" },
        { path: "/fl", ref: { id: "lattice/n1" }, target: "std/need" },
        { path: "/list/0", ref: { id: "lattice/t", version: 1 }, target: "std/term" },
        { path: "/list/1", ref: { id: "lattice/t", version: 1 }, target: "std/term" },
        { path: "/pin", ref: { id: "lattice/n1", version: 2 }, target: "std/need" },
      ];
      if (JSON.stringify((v as Admitted).refs) !== JSON.stringify(expected)) fail("refs " + JSON.stringify((v as Admitted).refs));
    },
  }),
  admitCase("SCN-KR-053", "refused references", '{"pin":"lattice/n1","fl":"lattice/n1@1","any":"not a ref","list":["#x"]}', () => T_REFS, {
    errors: [r("bad-ref", "/text/any"), r("bad-ref", "/text/fl"), r("bad-ref", "/text/list/0"), r("bad-ref", "/text/pin")],
  }),

  admitCase("SCN-KR-053", "references across a chain", '{"y":"lattice/y","x":"lattice/n1@2"}', () => T_RC, {
    check: (v) => {
      const expected = [
        { path: "/x", ref: { id: "lattice/n1", version: 2 }, target: "std/need" },
        { path: "/y", ref: { id: "lattice/y" }, target: "std/a" },
      ];
      if (JSON.stringify((v as Admitted).refs) !== JSON.stringify(expected)) fail("refs " + JSON.stringify((v as Admitted).refs));
    },
  }),

  // SCN-KR-055 — type bodies under the meta-type
  admitCase("SCN-KR-055", "empty schema", '{"schema":{"type":"object","properties":{}}}', () => kernel.metaType, { check: () => undefined }),
  admitCase("SCN-KR-055", "every field", '{"extends":"std/knowledge@2","schema":{"type":"object","properties":{}},"unique":["code"],"card":["title"]}', () => kernel.metaType, {
    check: (v) => {
      const expected = [{ path: "/extends", ref: { id: "std/knowledge", version: 2 }, target: "core/type" }];
      if (JSON.stringify((v as Admitted).refs) !== JSON.stringify(expected)) fail("refs");
    },
  }),
  admitCase("SCN-KR-055", "floating extends", '{"extends":"std/knowledge","schema":{"type":"object","properties":{}}}', () => kernel.metaType, {
    errors: [r("bad-ref", "/text/extends")],
  }),
  admitCase("SCN-KR-055", "root not an object", '{"schema":{"type":"string"}}', () => kernel.metaType, { errors: [r("bad-keyword", "/text/schema/type")] }),
  admitCase("SCN-KR-055", "no schema", "{}", () => kernel.metaType, { errors: [r("missing", "/text/schema")] }),
  admitCase("SCN-KR-055", "unknown field", '{"schema":{"type":"object","properties":{}},"in_force":[]}', () => kernel.metaType, {
    errors: [r("unknown-field", "/text/in_force")],
  }),
  admitCase("SCN-KR-055", "schema a number", '{"schema":5}', () => kernel.metaType, { errors: [r("wrong-type", "/text/schema")] }),
  admitCase("SCN-KR-055", "schema an array", '{"schema":[]}', () => kernel.metaType, { errors: [r("wrong-type", "/text/schema")] }),

  // SCN-KR-056 — an entity record
  {
    scn: "SCN-KR-056",
    name: "entity record",
    fn: "entity",
    args: () => [HEADER(), A_DOMAIN()],
    check: (v, args) => {
      const rec = v as Record<string, unknown>;
      const a = args[1] as Admitted;
      if (Object.keys(rec).join() !== "id,rev,type,hash,by,at,body") fail("keys " + Object.keys(rec).join());
      if (rec["id"] !== "lattice/domain-lifecycle" || rec["rev"] !== 3 || rec["by"] !== "lattice/" + ULID) fail("header");
      if (rec["type"] !== "std/domain@1" || rec["hash"] !== a.hash) fail("type or hash");
      if (rec["at"] !== "2026-09-26T19:40:12.345Z") fail("at " + String(rec["at"]));
      if (rec["body"] !== a.body) fail("not the body of the admission");
    },
  },

  // SCN-KR-057 — an event record and its of
  {
    scn: "SCN-KR-057",
    name: "event record",
    fn: "event",
    args: () => [EV_HEADER(), A_EVENT()],
    check: (v) => {
      const rec = v as Record<string, unknown>;
      if (Object.keys(rec).join() !== "id,type,by,at,body") fail("keys " + Object.keys(rec).join());
      if (rec["type"] !== "test/ev@1" || rec["at"] !== "1970-01-01T00:00:00.000Z") fail("type or at");
    },
  },
  { scn: "SCN-KR-057", name: "empty of", fn: "event", args: () => [EV_HEADER(), mustAdmit('{"of":{}}', T_EV)], check: () => undefined },
  { scn: "SCN-KR-057", name: "no of", fn: "event", args: () => [EV_HEADER(), mustAdmit('{"v":"pass"}', T_EV)], errors: [r("bad-of", "/admitted/body/of")] },
  {
    scn: "SCN-KR-057",
    name: "a role that is not a reference",
    fn: "event",
    args: () => [EV_HEADER(), mustAdmit('{"of":{"a":"x y","b":"lattice/x@1"}}', T_EV)],
    errors: [r("bad-of", "/admitted/body/of/a")],
  },
  { scn: "SCN-KR-057", name: "of not an object", fn: "event", args: () => [EV_HEADER(), mustAdmit('{"of":"lattice/x@1"}', T_EV2)], errors: [r("bad-of", "/admitted/body/of")] },

  // SCN-KR-058 — refusals of the envelope
  { scn: "SCN-KR-058", name: "header null", fn: "entity", args: () => [null, A_DOMAIN()], errors: [r("bad-header", "/header")] },
  {
    scn: "SCN-KR-058",
    name: "every field",
    fn: "entity",
    args: () => [{ id: "Lattice/x", rev: 0, by: "lattice/s@1", at: -1, extra: 1 }, {}],
    errors: [
      r("bad-header", "/header/extra"),
      r("bad-id", "/header/id"),
      r("bad-rev", "/header/rev"),
      r("bad-by", "/header/by"),
      r("bad-at", "/header/at"),
      r("bad-admitted", "/admitted"),
    ],
  },
  { scn: "SCN-KR-058", name: "at after 9999", fn: "entity", args: () => [{ ...HEADER(), at: 253402300800000 }, A_DOMAIN()], errors: [r("bad-at", "/header/at")] },
  { scn: "SCN-KR-058", name: "at fractional", fn: "entity", args: () => [{ ...HEADER(), at: 1.5 }, A_DOMAIN()], errors: [r("bad-at", "/header/at")] },
  {
    scn: "SCN-KR-058",
    name: "no by",
    fn: "entity",
    args: () => {
      const { by: _, ...h } = HEADER();
      return [h, A_DOMAIN()];
    },
    errors: [r("bad-by", "/header/by")],
  },
  {
    scn: "SCN-KR-058",
    name: "id getter not called",
    fn: "entity",
    args: () => {
      const h = HEADER();
      Object.defineProperty(h, "id", { enumerable: true, get: () => fail("getter called") });
      return [h, A_DOMAIN()];
    },
    errors: [r("bad-id", "/header/id")],
  },
  { scn: "SCN-KR-058", name: "a JSON copy of an admission", fn: "entity", args: () => [HEADER(), JSON.parse(JSON.stringify(A_DOMAIN()))], errors: [r("bad-admitted", "/admitted")] },
  { scn: "SCN-KR-058", name: "event header with rev", fn: "event", args: () => [{ ...EV_HEADER(), rev: 1 }, A_EVENT()], errors: [r("bad-header", "/header/rev")] },

  // SCN-KR-059 — formatting at
  { scn: "SCN-KR-059", name: "0", fn: "formatAt", args: () => [0], value: "1970-01-01T00:00:00.000Z" },
  { scn: "SCN-KR-059", name: "2026", fn: "formatAt", args: () => [1790451612345], value: "2026-09-26T19:40:12.345Z" },
  { scn: "SCN-KR-059", name: "last", fn: "formatAt", args: () => [253402300799999], value: "9999-12-31T23:59:59.999Z" },
  ...[-1, 1.5, 253402300800000, NaN].map((x): Case => ({ scn: "SCN-KR-059", name: String(x), fn: "formatAt", args: () => [x], errors: [r("bad-at", "")] })),

  // SCN-KR-060 — the transitional hash
  { scn: "SCN-KR-060", name: "hash", fn: "hash", args: () => ["std/domain", { name: "lifecycle", code: "LCY" }], value: "a4ab98af0a7f2bf7899d59506cd69fb5aab77c4e292679dc1f1a28ddcf251fe4" },
  { scn: "SCN-KR-060", name: "hash, other key order", fn: "hash", args: () => ["std/domain", { code: "LCY", name: "lifecycle" }], value: "a4ab98af0a7f2bf7899d59506cd69fb5aab77c4e292679dc1f1a28ddcf251fe4" },

  // SCN-KR-061 — refusals of the transitional hash
  ...["std/domain@1", "#3fa29c0d71be44a2b6c1d0e9f8a7b6c5", "domain", 5].map(
    (t): Case => ({ scn: "SCN-KR-061", name: "typeId " + String(t), fn: "hash", args: () => [t, {}], errors: [r("bad-type-id", "/typeId")] }),
  ),
  { scn: "SCN-KR-061", name: "body NaN", fn: "hash", args: () => ["std/domain", { x: NaN }], errors: [r("not-json", "/body/x")] },
  { scn: "SCN-KR-061", name: "both", fn: "hash", args: () => ["domain", { x: NaN }], errors: [r("bad-type-id", "/typeId"), r("not-json", "/body/x")] },

  // SCN-KR-062 — the transitional new id
  { scn: "SCN-KR-062", name: "valid", fn: "newId", args: () => ["warrant", ULID], value: "warrant/" + ULID },
  { scn: "SCN-KR-062", name: "bad namespace", fn: "newId", args: () => ["Warrant", ULID], errors: [r("bad-namespace", "/namespace")] },
  ...["01j8zq4n7x5k2m9r3t6v8w0y1a", "81J8ZQ4N7X5K2M9R3T6V8W0Y1A", "01J8ZQ4N7X5K2M9R3T6V8W0Y1", "01J8ZQ4N7X5K2M9R3T6V8W0YIL"].map(
    (u): Case => ({ scn: "SCN-KR-062", name: "bad ulid " + u, fn: "newId", args: () => ["warrant", u], errors: [r("bad-ulid", "/ulid")] }),
  ),
  { scn: "SCN-KR-062", name: "both", fn: "newId", args: () => ["Warrant", "x"], errors: [r("bad-namespace", "/namespace"), r("bad-ulid", "/ulid")] },
  { scn: "SCN-KR-062", name: "namespace of 64", fn: "newId", args: () => ["a".repeat(64), ULID], value: "a".repeat(64) + "/" + ULID },
  { scn: "SCN-KR-062", name: "namespace of 65", fn: "newId", args: () => ["a".repeat(65), ULID], errors: [r("bad-namespace", "/namespace")] },
];

/** A value of the given depth built in code: each level an array of one element, the deepest one empty. */
export function deepArray(depth: number): unknown[] {
  let v: unknown[] = [];
  for (let i = 1; i < depth; i++) v = [v];
  return v;
}

// SCN-KR-040 — a deep value built in code (also part of the SCN-KR-026 purity check).
export const deepCases: Case[] = [
  { scn: "SCN-KR-040", name: "canonical", fn: "canonical", args: () => [deepArray(100000)], value: "[".repeat(100000) + "]".repeat(100000) },
  { scn: "SCN-KR-040", name: "hash", fn: "hash", args: () => ["std/x", deepArray(100000)], check: () => undefined },
];
