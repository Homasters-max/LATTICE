// Identifiers and references (REQ-KR-005): grammar, parseRef, formatRef.

import type { Id, Ref, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";

const NAMESPACE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;
const NAMESPACE_MAX = 64;
const LOCAL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const VALUE_ID = /^#[0-9a-f]{32}$/;
const RESERVED = /^#[g-z][a-z0-9]*:[0-9a-f]+$/;
const VERSION = /^[1-9][0-9]*$/;

/** Kind of a string in the place of an identifier. */
export type IdKind = "name" | "value" | "reserved" | "bad";

export function isNamespace(s: unknown): s is string {
  return typeof s === "string" && s.length <= NAMESPACE_MAX && NAMESPACE.test(s);
}

export function idKind(s: unknown): IdKind {
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
export function isVersion(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 1;
}

function parseVersion(s: string): number | undefined {
  if (!VERSION.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : undefined;
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
  const kind = idKind(id);
  if (kind === "reserved") errors.push(refusal("reserved-scheme", "/id"));
  else if (kind === "bad") errors.push(refusal("bad-id", "/id"));
  if (version !== undefined && !isVersion(version)) errors.push(refusal("bad-version", "/version"));
  if (errors.length > 0) return fail(errors);
  return ok(version === undefined ? (id as string) : (id as string) + "@" + String(version));
}
