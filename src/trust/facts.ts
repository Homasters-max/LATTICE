// Facts (TR-F01, TR-F02, TR-F05, REQ-TR-002, design D-7): the current value of every fact key, and the one `live`
// revision per entity `id`. In S0 every fact counts: in force (TR-I01) and the owner-act floor (TR-F06) are not checked.

import { canonical } from "../kernel/index.ts";

/** The type of the status fact `live` in the `std` package (REQ-LG-007). */
export const LIVE_TYPE = "std/live@1";

const isObject = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The key text and the value of a fact body, `revoked` for a cancellation; `null` when it is not a fact body. */
function factOf(body: unknown): { key: string; value: unknown; revoked: boolean } | null {
  if (!isObject(body) || !isObject(body.key)) return null;
  const hasValue = Object.hasOwn(body, "value");
  const hasRevoked = Object.hasOwn(body, "revoked");
  if (hasValue === hasRevoked) return null; // both or neither
  if (hasRevoked && body.revoked !== true) return null;
  const key = canonical(body.key);
  if (!key.ok) return null;
  return { key: key.value, value: hasValue ? body.value : undefined, revoked: hasRevoked };
}

const readOnly = (): never => {
  throw new TypeError("the current facts are frozen");
};

/** The current value of every key (TR-F02): the latest fact body of the key wins; a cancellation removes the key. */
export function currentFacts(bodies: readonly unknown[]): ReadonlyMap<string, unknown> {
  const current = new Map<string, unknown>();
  for (const body of bodies) {
    const fact = factOf(body);
    if (fact === null) continue;
    if (fact.revoked) current.delete(fact.key);
    else current.set(fact.key, fact.value);
  }
  // Object.freeze alone leaves a Map writable: its own set, delete and clear refuse.
  Object.defineProperties(current, { set: { value: readOnly }, delete: { value: readOnly }, clear: { value: readOnly } });
  return Object.freeze(current);
}

/** The revision named by the current `live` fact of `id` (TR-F05), or `undefined` when there is none. */
export function liveRevision(events: readonly { readonly type: string; readonly body: unknown }[], id: string): number | undefined {
  const key = canonical({ id });
  if (!key.ok) return undefined;
  const value = currentFacts(events.filter((e) => e.type === LIVE_TYPE).map((e) => e.body)).get(key.value);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}
