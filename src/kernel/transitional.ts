// The transitional interface for the callers of S0 (REQ-KR-018, design D-1): `hash` over a type id without `@n` (the
// commit and proposal hashes of `ledger`, LG-C02) and `newId` (the session id of `assembly`). #83 moves the callers to
// `admit` and the event id of OM-I02, and removes both.

import { createHash } from "node:crypto";
import type { Hash, HashCode, Id, NewIdCode, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";
import { canonical } from "./canonical.ts";
import { isIdentifier, isNamespace } from "./ref.ts";

// 26 characters of Crockford Base32, upper case, first character 0–7 (48-bit time fits).
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** 64 lower-case hex digits of sha256 of the canonical form of `{"type": typeId, "body": body}`. */
export function hash(typeId: unknown, body: unknown): Result<Hash, HashCode> {
  if (!isIdentifier(typeId)) {
    // The refused typeId is left out of the envelope; the body is still checked, its refusal comes second.
    const b = canonical({ body });
    return fail<HashCode>(b.ok ? [refusal("bad-type-id", "/typeId")] : [refusal("bad-type-id", "/typeId"), ...b.errors]);
  }
  // An identifier is always JSON: a refusal here is inside the body, with its `/body` prefix from the walk.
  const text = canonical({ body, type: typeId });
  if (!text.ok) return fail<HashCode>(text.errors);
  return ok(createHash("sha256").update(text.value, "utf8").digest("hex") as Hash);
}

/** `namespace/ulid` from a ULID given as an argument: the kernel neither reads the clock nor makes ULIDs. */
export function newId(namespace: unknown, ulid: unknown): Result<Id, NewIdCode> {
  const errors: Refusal<NewIdCode>[] = [];
  if (!isNamespace(namespace)) errors.push(refusal("bad-namespace", "/namespace"));
  if (typeof ulid !== "string" || !ULID.test(ulid)) errors.push(refusal("bad-ulid", "/ulid"));
  if (errors.length > 0) return fail(errors);
  return ok(((namespace as string) + "/" + (ulid as string)) as Id);
}
