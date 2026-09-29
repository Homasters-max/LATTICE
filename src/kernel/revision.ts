// Revision form (REQ-KR-007): {id, type, version, at, by, body} from the input and the time given as an argument;
// no rule, type or kind checks. The body is carried by reference: no copy, no freeze.

import type { Id, Refusal, Result } from "./types.ts";
import { fail, ok, refusal, segment } from "./types.ts";
import { checkAt } from "./ref.ts";

export type Revision = {
  readonly id: Id;
  readonly type: string;
  readonly version: number;
  readonly at: string;
  readonly by: Id;
  readonly body: unknown;
};

const FIELDS = ["id", "type", "version", "by", "body"];
const AT_MAX = 253402300799999; // 9999-12-31T23:59:59.999Z

/** Own data property of the input; an accessor is not called and counts as a wrong field. */
function field(input: object, key: string): { readonly present: boolean; readonly value: unknown } {
  const d = Object.getOwnPropertyDescriptor(input, key);
  if (d === undefined) return { present: false, value: undefined };
  if (!("value" in d)) return { present: true, value: undefined };
  return { present: true, value: d.value };
}

export function revision(input: unknown, at: unknown): Result<Revision> {
  const errors: Refusal[] = [];
  let id: unknown;
  let type: unknown;
  let version: unknown;
  let by: unknown;
  let body: unknown;
  const proto = typeof input === "object" && input !== null ? Object.getPrototypeOf(input) : undefined;
  if (proto !== Object.prototype && proto !== null) {
    errors.push(refusal("bad-input", "/input"));
  } else {
    const obj = input as object;
    const own = Reflect.ownKeys(obj);
    for (const k of own) {
      if (typeof k === "string" && !FIELDS.includes(k)) errors.push(refusal("bad-input", "/input" + segment(k)));
    }
    if (own.some((k) => typeof k === "symbol")) errors.push(refusal("bad-input", "/input"));
    id = field(obj, "id").value;
    type = field(obj, "type").value;
    version = field(obj, "version").value;
    by = field(obj, "by").value;
    const b = field(obj, "body");
    body = b.value;
    // Rows of the REQ-KR-005 table, refusals in this order: id, type, version, by.
    const checks = [
      checkAt("id", id, "/input/id"),
      checkAt("type", type, "/input/type"),
      checkAt("version", version, "/input/version"),
      checkAt("by", by, "/input/by"),
    ];
    for (const r of checks) if (r !== null) errors.push(r);
    if (!b.present || body === undefined) errors.push(refusal("bad-body", "/input/body"));
  }
  const atOk = typeof at === "number" && Number.isSafeInteger(at) && at >= 0 && at <= AT_MAX;
  if (!atOk) errors.push(refusal("bad-at", "/at"));
  if (errors.length > 0) return fail(errors);
  return ok({
    id: id as Id,
    type: type as string,
    version: version as number,
    at: new Date(at as number).toISOString(),
    by: by as Id,
    body,
  });
}
