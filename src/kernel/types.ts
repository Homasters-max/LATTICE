// Values and shapes of the kernel interface (REQ-KR-008, design D-9): a refusal is a value, never an exception, and
// every function closes its refusal codes as a union.

export type Refusal<C extends string = string> = { readonly code: C; readonly path: string };

export type Result<T, C extends string = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly Refusal<C>[] };

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Identifier `namespace/local` (REQ-KR-012). */
export type Id = Brand<string, "Id">;
/** A hash as text: `sha256:` + 64 hex from `admit`, or 64 bare hex from the transitional `hash` until #83. */
export type Hash = Brand<string, "Hash">;
/** Parsed reference: floating (`{ id }`) or pinned (`{ id, version }`) — REQ-KR-012. */
export type Ref = { readonly id: Id; readonly version?: number };

/** A reference a schema declares, found in an admitted body (REQ-KR-015). */
export type BodyRef = { readonly path: string; readonly ref: Ref; readonly target: string };

/** The type `admit` takes (REQ-KR-014): its pinned reference and the admitted body of its first record. */
export type Type = { readonly ref: string; readonly body: Readonly<Record<string, unknown>> };

/** An admitted body (REQ-KR-013). */
export type Admitted = {
  readonly body: unknown;
  readonly type: string;
  readonly hash: Hash;
  readonly refs: readonly BodyRef[];
};

/** Entity record of OM-E01 (REQ-KR-017). */
export type EntityRecord = {
  readonly id: Id;
  readonly rev: number;
  readonly type: string;
  readonly hash: Hash;
  readonly by: Id;
  readonly at: string;
  readonly body: unknown;
};

/** Event record of OM-E01 (REQ-KR-017). */
export type EventRecord = {
  readonly id: Id;
  readonly type: string;
  readonly by: Id;
  readonly at: string;
  readonly body: unknown;
};

export type InputCode =
  | "syntax"
  | "too-deep"
  | "duplicate-key"
  | "negative-zero"
  | "non-finite"
  | "unsafe-integer"
  | "lone-surrogate"
  | "unassigned";
export type CanonicalCode = "not-json";
export type ParseRefCode = "bad-ref";
export type FormatRefCode = "bad-id" | "bad-version";
export type SchemaCode =
  | "wrong-type"
  | "missing"
  | "unknown-field"
  | "too-long"
  | "not-in-enum"
  | "bad-ref"
  | "unknown-keyword"
  | "bad-keyword";
export type AdmitCode = "bad-type" | InputCode | "too-large" | SchemaCode;
export type TypeOfCode = "not-type" | "chain-too-long" | "bad-extends";
export type EnvelopeCode = "bad-header" | "bad-id" | "bad-rev" | "bad-by" | "bad-at" | "bad-admitted" | "bad-of";
export type FormatAtCode = "bad-at";
export type HashCode = "bad-type-id" | "not-json";
export type NewIdCode = "bad-namespace" | "bad-ulid";

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function fail<C extends string>(errors: readonly Refusal<C>[]): { readonly ok: false; readonly errors: readonly Refusal<C>[] } {
  return { ok: false, errors };
}

export function refusal<C extends string>(code: C, path: string): Refusal<C> {
  return { code, path };
}

/** One JSON Pointer segment (RFC 6901): `~` -> `~0`, `/` -> `~1`. */
export function segment(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Order by UTF-16 code units. */
export function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** An object whose prototype is `Object.prototype` or `null` (not an array). */
export function isPlainObject(value: unknown): value is object {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** An own data property, read without calling a getter; an accessor or an absent key gives `present: false`. */
export function ownData(obj: object, key: string): { readonly present: boolean; readonly value: unknown } {
  const d = Object.getOwnPropertyDescriptor(obj, key);
  if (d === undefined || !("value" in d)) return { present: false, value: undefined };
  return { present: true, value: d.value };
}

/** Freezes a value the kernel built and everything reachable from it. */
export function deepFreeze<T>(value: T): T {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (typeof v === "object" && v !== null && !Object.isFrozen(v)) {
      Object.freeze(v);
      for (const k of Object.keys(v)) stack.push((v as Record<string, unknown>)[k]);
    }
  }
  return value;
}
