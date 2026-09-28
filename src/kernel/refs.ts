// References in a body (REQ-KR-006): walk like canonical, collect {"$ref": s} objects, first appearance of a string.

import type { Ref, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";
import { walk } from "./canonical.ts";
import { parseRef } from "./ref.ts";

export function refsOf(body: unknown): Result<readonly Ref[]> {
  const refs: Ref[] = [];
  const seen = new Set<string>();
  const bad: Refusal[] = [];
  const enterObject = (obj: object, path: string): void => {
    const d = Object.getOwnPropertyDescriptor(obj, "$ref");
    if (d === undefined) return;
    // Other keys, a non-string or not a reference (the string as is, without NFC) — bad-ref at the object, on entry.
    const others = Reflect.ownKeys(obj).length > 1;
    const s: unknown = "value" in d ? d.value : undefined;
    const parsed = typeof s === "string" ? parseRef(s) : undefined;
    if (others || parsed === undefined || !parsed.ok) {
      bad.push(refusal("bad-ref", path));
      return;
    }
    if (!seen.has(s as string)) {
      seen.add(s as string);
      refs.push(parsed.value);
    }
  };
  const r = walk(body, false, "", { enterObject });
  if (r.error !== null) return fail([r.error]);
  if (bad.length > 0) return fail(bad);
  return ok(refs);
}
