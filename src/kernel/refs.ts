// References in a body (REQ-KR-006): walk like canonical, collect {"$ref": s} objects, first appearance of a string.

import type { Ref, Refusal, Result } from "./types.ts";
import { fail, ok, refusal } from "./types.ts";
import { eachObject } from "./canonical.ts";
import { refObject } from "./ref.ts";

export function refsOf(body: unknown): Result<readonly Ref[]> {
  const refs: Ref[] = [];
  const seen = new Set<string>();
  const bad: Refusal[] = [];
  const error = eachObject(body, (obj, path) => {
    const d = Object.getOwnPropertyDescriptor(obj, "$ref");
    if (d === undefined) return;
    // Other keys, a non-string or not a reference (the string as is, without NFC) — bad-ref at the object, on entry.
    // By value: any other own key counts, an accessor is the value `undefined`, no string is refused as text.
    const others = Reflect.ownKeys(obj).length > 1;
    const s: unknown = "value" in d ? d.value : undefined;
    const ref = refObject(others, s, false);
    if (ref === null) {
      bad.push(refusal("bad-ref", path));
      return;
    }
    const text = s as string; // refObject admits only a string
    if (!seen.has(text)) {
      seen.add(text);
      refs.push(ref);
    }
  });
  if (error !== null) return fail([error]);
  if (bad.length > 0) return fail(bad);
  return ok(refs);
}
