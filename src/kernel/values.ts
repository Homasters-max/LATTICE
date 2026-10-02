// Plain JSON values as the kernel reads and builds them: code unit order, the plain-object test, own data properties
// read without calling a getter, and deep freezing of what the kernel built (REQ-KR-008, SL-T02).

/** Order by UTF-16 code units. */
export function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** An object whose prototype is `Object.prototype` or `null` (not an array). */
export function isPlainObject(value: unknown): value is object {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** An own data property, read without calling a getter; an accessor or an absent key gives `present: false`. */
export function ownData(obj: object, key: string): { readonly present: boolean; readonly value: unknown } {
  const d = Object.getOwnPropertyDescriptor(obj, key);
  if (d === undefined || !("value" in d)) return { present: false, value: undefined };
  return { present: true, value: d.value };
}

/** Freezes a value the kernel built and everything reachable from it. */
export function deepFreeze<T>(value: T): T {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (typeof v === "object" && v !== null && !Object.isFrozen(v)) {
      Object.freeze(v);
      for (const k of Object.keys(v)) stack.push((v as Record<string, unknown>)[k]);
    }
  }
  return value;
}
