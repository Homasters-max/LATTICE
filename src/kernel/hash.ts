// Hash and value id (REQ-KR-004, design D-3): sha256 of the canonical form of {"type": typeId, "body": body}.

import { createHash } from "node:crypto";
import type { Hash, Id, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";
import { walk } from "./canonical.ts";
import { idKind } from "./ref.ts";

export function hash(typeId: unknown, body: unknown): Result<Hash> {
  const errors: Refusal[] = [];
  if (idKind(typeId) !== "name") errors.push(refusal("bad-type-id", "/typeId"));
  const b = walk(body, true, "/body", {});
  if (b.error !== null) errors.push(b.error);
  if (errors.length > 0) return fail(errors);
  // Keys of {"type", "body"} in canonical order: "body" < "type".
  const text = '{"body":' + b.text + ',"type":' + JSON.stringify(typeId) + "}";
  return ok(createHash("sha256").update(text, "utf8").digest("hex") as Hash);
}

/** `#` and the first 32 hex digits of the hash (value id scheme 1). */
export function valueId(typeId: unknown, body: unknown): Result<Id> {
  const h = hash(typeId, body);
  return h.ok ? ok(("#" + h.value.slice(0, 32)) as Id) : h;
}
