// Hash and value id (REQ-KR-004, design D-3): sha256 of the canonical form of {"type": typeId, "body": body}.

import { createHash } from "node:crypto";
import type { Hash, Id, Result } from "./types.ts";
import { fail, ok } from "./types.ts";
import { canonical } from "./canonical.ts";
import { checkAt } from "./ref.ts";

export function hash(typeId: unknown, body: unknown): Result<Hash> {
  // The envelope itself is canonicalised, so a refusal inside the body gets its `/body` prefix from the walk.
  const badType = checkAt("typeId", typeId, "/typeId");
  if (badType !== null) {
    // The refused typeId is left out of the envelope; the body is still checked, its refusal comes second.
    const b = canonical({ body });
    return fail(b.ok ? [badType] : [badType, ...b.errors]);
  }
  // A typeId of the grammar is always JSON: a refusal here is inside the body.
  const text = canonical({ body, type: typeId });
  if (!text.ok) return fail(text.errors);
  return ok(createHash("sha256").update(text.value, "utf8").digest("hex") as Hash);
}

/** `#` and the first 32 hex digits of the hash (value id scheme 1). */
export function valueId(typeId: unknown, body: unknown): Result<Id> {
  const h = hash(typeId, body);
  return h.ok ? ok(("#" + h.value.slice(0, 32)) as Id) : h;
}
