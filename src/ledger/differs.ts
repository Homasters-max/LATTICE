// The differing paths of colliding intents (LG-A02, REQ-LG-002, design D-3): JSON pointers, relative to an intent, of
// the places where the values do not all agree. Symmetric in its inputs, so the order of the intents does not matter
// (LG-C07); s0-apply-typed-checks (#82) reuses it for fact keys and uniqueness.

import { canonical } from "../kernel/index.ts";
import { byCodeUnits } from "./records.ts";

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function allEqual(values: readonly unknown[]): boolean {
  const texts = values.map((v) => {
    const text = canonical(v);
    if (!text.ok) throw new Error("differs: not JSON");
    return text.value;
  });
  return texts.every((t) => t === texts[0]);
}

const step = (key: string): string => "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");

function walk(values: readonly unknown[], path: string, found: string[]): void {
  if (allEqual(values)) return;
  if (values.every(isPlainObject)) {
    const keys = [...new Set(values.flatMap((v) => Object.keys(v)))].sort(byCodeUnits);
    for (const key of keys) {
      const at = path + step(key);
      if (values.some((v) => !Object.hasOwn(v, key))) found.push(at);
      else walk(values.map((v) => v[key]), at, found);
    }
    return;
  }
  const first = values[0];
  if (Array.isArray(first) && values.every((v) => Array.isArray(v) && v.length === first.length)) {
    for (let i = 0; i < first.length; i++) walk(values.map((v) => (v as readonly unknown[])[i]), `${path}/${i}`, found);
    return;
  }
  found.push(path);
}

/** The paths where `values` (at least one JSON value) differ, ordered by UTF-16 code units; `[]` when all are equal. */
export function differs(values: readonly unknown[]): readonly string[] {
  const found: string[] = [];
  walk(values, "", found);
  return found.sort(byCodeUnits);
}
