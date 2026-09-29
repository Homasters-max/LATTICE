// Identifiers and references (REQ-KR-005): grammar, the table of positions (checkAt), the verdict on a {"$ref"}
// object (refObject), parseRef, formatRef. The grammar predicates stay inside this file.

import type { Id, Ref, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";

const NAMESPACE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;
const NAMESPACE_MAX = 64;
const LOCAL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const VALUE_ID = /^#[0-9a-f]{32}$/;
const RESERVED = /^#[g-z][a-z0-9]*:[0-9a-f]+$/;
const VERSION = /^[1-9][0-9]*$/;

/** Kind of a string in the place of an identifier. */
type IdKind = "name" | "value" | "reserved" | "bad";

/** A place of the kernel interface that holds an identifier, a type reference, a version or a namespace. */
type Position = "id" | "typeId" | "type" | "by" | "version" | "namespace";

function isNamespace(s: unknown): s is string {
  return typeof s === "string" && s.length <= NAMESPACE_MAX && NAMESPACE.test(s);
}

function idKind(s: unknown): IdKind {
  if (typeof s !== "string") return "bad";
  if (VALUE_ID.test(s)) return "value";
  if (RESERVED.test(s)) return "reserved";
  const slash = s.indexOf("/");
  if (slash < 0) return "bad";
  const ns = s.slice(0, slash);
  const local = s.slice(slash + 1);
  return isNamespace(ns) && LOCAL.test(local) ? "name" : "bad";
}

/** A version: decimal integer without leading zeros, 1 … 2^53−1. */
function isVersion(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 1;
}

function parseVersion(s: string): number | undefined {
  if (!VERSION.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : undefined;
}

/** A pinned type reference `namespace/local@n`; a value id or a reference without a version is not a type. */
function isPinnedType(s: unknown): boolean {
  const r = parseRef(s);
  return r.ok && r.value.version !== undefined && idKind(r.value.id) === "name";
}

/**
 * The value at a position against its row of the REQ-KR-005 table: `null` when allowed, else the refusal of that
 * position at `path`.
 *
 * | position    | allowed                              | refusal                               |
 * |-------------|--------------------------------------|---------------------------------------|
 * | `id`        | `namespace/local` or a value id      | `reserved-scheme`, otherwise `bad-id` |
 * | `typeId`    | `namespace/local`                    | `bad-type-id`                         |
 * | `type`      | pinned reference `namespace/local@n` | `bad-type`                            |
 * | `by`        | `namespace/local`                    | `bad-by`                              |
 * | `version`   | integer 1 … 2^53−1                   | `bad-version`                         |
 * | `namespace` | `namespace`, at most 64 characters   | `bad-namespace`                       |
 */
export function checkAt(position: Position, value: unknown, path: string): Refusal | null {
  switch (position) {
    case "id": {
      const kind = idKind(value);
      if (kind === "reserved") return refusal("reserved-scheme", path);
      return kind === "bad" ? refusal("bad-id", path) : null;
    }
    case "typeId":
      return idKind(value) === "name" ? null : refusal("bad-type-id", path);
    case "type":
      return isPinnedType(value) ? null : refusal("bad-type", path);
    case "by":
      return idKind(value) === "name" ? null : refusal("bad-by", path);
    case "version":
      return isVersion(value) ? null : refusal("bad-version", path);
    case "namespace":
      return isNamespace(value) ? null : refusal("bad-namespace", path);
  }
}

/** What the caller knows of a `$ref` object: it has other keys; its string was refused as text. */
type RefObjectFacts = { readonly others: boolean; readonly rejected: boolean };

/** A `$ref` object that is a reference: the reference and the string it was parsed from. */
type RefObject = { readonly ref: Ref; readonly source: string };

/**
 * Verdict on an object with the key `$ref` (REQ-KR-002, REQ-KR-006): its reference, or `null` — the caller refuses
 * `bad-ref` at its own path — when the object has other keys, the value is not a string, the string was refused as
 * text or is not a reference. What counts as another key and as a refused string is the caller's.
 */
export function refObject(value: unknown, facts: RefObjectFacts): RefObject | null {
  if (facts.others || typeof value !== "string" || facts.rejected) return null;
  const r = parseRef(value);
  return r.ok ? { ref: r.value, source: value } : null;
}

/** Parse `id` or `id@version`; the reserved scheme is refused with any `@…` suffix. */
export function parseRef(s: unknown): Result<Ref> {
  if (typeof s !== "string") return fail([refusal("bad-ref", "")]);
  const at = s.indexOf("@");
  const idPart = at < 0 ? s : s.slice(0, at);
  const kind = idKind(idPart);
  if (kind === "reserved") return fail([refusal("reserved-scheme", "")]);
  if (kind === "bad") return fail([refusal("bad-ref", "")]);
  const id = idPart as Id;
  if (at < 0) return ok({ id });
  const version = parseVersion(s.slice(at + 1));
  if (version === undefined) return fail([refusal("bad-ref", "")]);
  return ok({ id, version });
}

/** Build the reference string; `parseRef(formatRef(r))` gives `r` back. */
export function formatRef(id: unknown, version?: unknown): Result<string> {
  const errors: Refusal[] = [];
  const badId = checkAt("id", id, "/id");
  if (badId !== null) errors.push(badId);
  const badVersion = version === undefined ? null : checkAt("version", version, "/version");
  if (badVersion !== null) errors.push(badVersion);
  if (errors.length > 0) return fail(errors);
  return ok(version === undefined ? (id as string) : (id as string) + "@" + String(version));
}
