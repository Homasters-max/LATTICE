// Identifiers and references (REQ-KR-012, OM-R01): the grammar and parseRef / formatRef. There is no value id and no
// reserved scheme (OM-K02, OM-I03); the identifier grammar of OM-I05 comes with the callers in #83.

import type { FormatRefCode, Id, ParseRefCode, Ref, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";

const NAMESPACE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;
const NAMESPACE_MAX = 64;
const LOCAL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const VERSION = /^[1-9][0-9]*$/;

/** A namespace: `[a-z][a-z0-9-]*` with `.` parts, at most 64 characters. */
export function isNamespace(s: unknown): s is string {
  return typeof s === "string" && s.length <= NAMESPACE_MAX && NAMESPACE.test(s);
}

/** An identifier `namespace/local`. */
export function isIdentifier(s: unknown): s is Id {
  if (typeof s !== "string") return false;
  const slash = s.indexOf("/");
  if (slash < 0) return false;
  return isNamespace(s.slice(0, slash)) && LOCAL.test(s.slice(slash + 1));
}

/** A version: integer 1 … 2^53−1. */
export function isVersion(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 1;
}

/** Parse `id` or `id@version`. */
export function parseRef(s: unknown): Result<Ref, ParseRefCode> {
  const bad = fail([refusal<ParseRefCode>("bad-ref", "")]);
  if (typeof s !== "string") return bad;
  const at = s.indexOf("@");
  const idPart = at < 0 ? s : s.slice(0, at);
  if (!isIdentifier(idPart)) return bad;
  if (at < 0) return ok({ id: idPart });
  const v = s.slice(at + 1);
  if (!VERSION.test(v)) return bad;
  const version = Number(v);
  return Number.isSafeInteger(version) ? ok({ id: idPart, version }) : bad;
}

/** Build the reference string; `parseRef(formatRef(r))` gives `r` back. */
export function formatRef(id: unknown, version?: unknown): Result<string, FormatRefCode> {
  const errors: Refusal<FormatRefCode>[] = [];
  if (!isIdentifier(id)) errors.push(refusal("bad-id", "/id"));
  if (version !== undefined && !isVersion(version)) errors.push(refusal("bad-version", "/version"));
  if (errors.length > 0) return fail(errors);
  return ok(version === undefined ? (id as string) : (id as string) + "@" + String(version));
}
