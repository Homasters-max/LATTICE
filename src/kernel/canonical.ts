// Canonical form — JCS, RFC 8785 (REQ-KR-003, design D-2). The walk keeps an explicit stack of frames instead of
// recursion, so a value of any depth built in code is serialised without exhausting the call stack. Two operations
// share the walk through a visitor: canonical builds the text, eachObject hands every object to a function.

import type { Refusal, Result } from "./types.ts";
import { fail, ok, refusal, segment } from "./types.ts";
import { hasLoneSurrogate } from "./admit.ts";

/** What the walk reports, in walk order; every reported value has passed its own checks. */
type Visitor = {
  /** A string, a finite number, a boolean or null. */
  readonly scalar: (value: string | number | boolean | null) => void;
  /** Entering an array or a plain object, before its children; `path` gives the JSON Pointer of the container. */
  readonly enter: (container: object, isArray: boolean, path: () => string) => void;
  /** Before the child number `index` of the innermost container; `key` of an object member. */
  readonly child: (index: number, key: string | undefined) => void;
  /** Leaving the innermost container after its last child. */
  readonly leave: (isArray: boolean) => void;
};

type ObjFrame = { readonly kind: "obj"; readonly obj: object; readonly keys: readonly string[]; i: number };
type ArrFrame = {
  readonly kind: "arr";
  readonly arr: object;
  readonly len: number;
  readonly extra: readonly string[];
  i: number;
};
type Frame = ObjFrame | ArrFrame;

const nothing = (): void => {};

function isIndexKey(k: string, len: number): boolean {
  const n = Number(k);
  return String(n) === k && Number.isInteger(n) && n >= 0 && n < len;
}

/**
 * Walk a JSON value depth first — object members in canonical key order, array elements by index — checking that
 * it is a JSON value and reporting it to the visitor; the first place that is not gives `not-json` with its path.
 */
function walk(root: unknown, visitor: Visitor): Refusal | null {
  const frames: Frame[] = [];
  const segs: string[] = [];
  const onPath = new Set<object>();
  const here = (): string => segs.join("");
  const notJson = (seg: string): Refusal => refusal("not-json", here() + seg);

  const visit = (value: unknown, seg: string): Refusal | null => {
    switch (typeof value) {
      case "string":
        if (hasLoneSurrogate(value)) return notJson(seg);
        visitor.scalar(value);
        return null;
      case "number":
        if (!Number.isFinite(value)) return notJson(seg);
        visitor.scalar(value);
        return null;
      case "boolean":
        visitor.scalar(value);
        return null;
      case "object": {
        if (value === null) {
          visitor.scalar(null);
          return null;
        }
        if (onPath.has(value)) return notJson(seg);
        const own = Reflect.ownKeys(value);
        if (Array.isArray(value)) {
          if (Object.getPrototypeOf(value) !== Array.prototype) return notJson(seg);
          if (own.some((k) => typeof k === "symbol")) return notJson(seg);
          const len = value.length;
          const extra = (own as string[]).filter((k) => k !== "length" && !isIndexKey(k, len)).sort();
          frames.push({ kind: "arr", arr: value, len, extra, i: 0 });
          segs.push(seg);
          onPath.add(value);
          visitor.enter(value, true, here);
          return null;
        }
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) return notJson(seg);
        if (own.some((k) => typeof k === "symbol")) return notJson(seg);
        const keys = (own as string[]).slice().sort();
        frames.push({ kind: "obj", obj: value, keys, i: 0 });
        segs.push(seg);
        onPath.add(value);
        visitor.enter(value, false, here);
        return null;
      }
      default:
        return notJson(seg);
    }
  };

  const leave = (frame: Frame): void => {
    frames.pop();
    segs.pop();
    onPath.delete(frame.kind === "obj" ? frame.obj : frame.arr);
    visitor.leave(frame.kind === "arr");
  };

  let error = visit(root, "");
  while (error === null && frames.length > 0) {
    const frame = frames[frames.length - 1] as Frame;
    if (frame.kind === "obj") {
      if (frame.i >= frame.keys.length) {
        leave(frame);
        continue;
      }
      const index = frame.i;
      const key = frame.keys[index] as string;
      frame.i++;
      const seg = segment(key);
      const d = Object.getOwnPropertyDescriptor(frame.obj, key);
      if (d === undefined || !("value" in d) || d.enumerable !== true || hasLoneSurrogate(key)) {
        error = notJson(seg);
        break;
      }
      visitor.child(index, key);
      error = visit(d.value, seg);
    } else {
      if (frame.i < frame.len) {
        const index = frame.i;
        frame.i++;
        const seg = "/" + String(index);
        const d = Object.getOwnPropertyDescriptor(frame.arr, String(index));
        if (d === undefined || !("value" in d) || d.enumerable !== true) {
          error = notJson(seg);
          break;
        }
        visitor.child(index, undefined);
        error = visit(d.value, seg);
        continue;
      }
      if (frame.extra.length > 0) {
        error = notJson(segment(frame.extra[0] as string));
        break;
      }
      leave(frame);
    }
  }
  return error;
}

/** Canonical form of a JSON value: JCS without changes; strings are not normalised (NFC belongs to checkInput). */
export function canonical(value: unknown): Result<string> {
  const out: string[] = [];
  const error = walk(value, {
    scalar: (v) => out.push(typeof v === "string" ? JSON.stringify(v) : String(v)),
    enter: (_container, isArray) => out.push(isArray ? "[" : "{"),
    child: (index, key) => {
      if (index > 0) out.push(",");
      if (key !== undefined) out.push(JSON.stringify(key), ":");
    },
    leave: (isArray) => out.push(isArray ? "]" : "}"),
  });
  return error === null ? ok(out.join("")) : fail([error]);
}

/**
 * Walk a value like canonical and call `fn` on entering each plain object, after its own checks and before its
 * members, with its path; the result is the `not-json` refusal of canonical or `null`.
 */
export function eachObject(value: unknown, fn: (obj: object, path: string) => void): Refusal | null {
  return walk(value, {
    scalar: nothing,
    enter: (container, isArray, path) => {
      if (!isArray) fn(container, path());
    },
    child: nothing,
    leave: nothing,
  });
}
