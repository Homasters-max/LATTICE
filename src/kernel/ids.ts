// New identifier from a ULID given as an argument (REQ-KR-005): the kernel neither reads the clock nor makes ULIDs.

import type { Id, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";
import { isNamespace } from "./ref.ts";

// 26 characters of Crockford Base32, upper case, first character 0–7 (48-bit time fits).
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export function newId(namespace: unknown, ulid: unknown): Result<Id> {
  const errors: Refusal[] = [];
  if (!isNamespace(namespace)) errors.push(refusal("bad-namespace", "/namespace"));
  if (typeof ulid !== "string" || !ULID.test(ulid)) errors.push(refusal("bad-ulid", "/ulid"));
  if (errors.length > 0) return fail(errors);
  return ok(((namespace as string) + "/" + (ulid as string)) as Id);
}
