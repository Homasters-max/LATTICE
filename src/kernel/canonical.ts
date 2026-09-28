// Canonical form — JCS, RFC 8785 (REQ-KR-003, design D-2). The walk keeps an explicit stack of frames instead of
// recursion, so a value of any depth built in code is serialised without exhausting the call stack.

import type { Refusal, Result } from "./types.ts";
import { fail, ok, refusal, segment } from "./types.ts";

export type WalkHooks = {
  /** Called on entering a plain object after its own checks and before its members, in walk order. */
  readonly enterObject?: (obj: object, path: string) => void;
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

/** True when the string has a UTF-16 surrogate that is not part of a pair. */
export function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) i++;
      else return true;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isIndexKey(k: string, len: number): boolean {
  const n = Number(k);
  return String(n) === k && Number.isInteger(n) && n >= 0 && n < len;
}

export type WalkResult = { readonly error: Refusal | null; readonly text: string };

/**
 * Walk a JSON value depth first — object members in canonical key order, array elements by index — checking that
 * it is a JSON value; the first place that is not gives `not-json` with its path (prefixed by `prefix`). With `emit`
 * the canonical text is built along the way.
 */
export function walk(root: unknown, emit: boolean, prefix: string, hooks: WalkHooks): WalkResult {
  const out: string[] = [];
  const frames: Frame[] = [];
  const segs: string[] = [];
  const onPath = new Set<object>();
  const pathOf = (seg: string): string => prefix + segs.join("") + seg;
  const notJson = (seg: string): Refusal => refusal("not-json", pathOf(seg));

  const visit = (value: unknown, seg: string): Refusal | null => {
    switch (typeof value) {
      case "string":
        if (hasLoneSurrogate(value)) return notJson(seg);
        if (emit) out.push(JSON.stringify(value));
        return null;
      case "number":
        if (!Number.isFinite(value)) return notJson(seg);
        if (emit) out.push(String(value));
        return null;
      case "boolean":
        if (emit) out.push(value ? "true" : "false");
        return null;
      case "object": {
        if (value === null) {
          if (emit) out.push("null");
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
          if (emit) out.push("[");
          return null;
        }
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) return notJson(seg);
        if (own.some((k) => typeof k === "symbol")) return notJson(seg);
        const keys = (own as string[]).slice().sort();
        frames.push({ kind: "obj", obj: value, keys, i: 0 });
        segs.push(seg);
        onPath.add(value);
        if (hooks.enterObject !== undefined) hooks.enterObject(value, pathOf(""));
        if (emit) out.push("{");
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
  };

  let error = visit(root, "");
  while (error === null && frames.length > 0) {
    const frame = frames[frames.length - 1] as Frame;
    if (frame.kind === "obj") {
      if (frame.i >= frame.keys.length) {
        if (emit) out.push("}");
        leave(frame);
        continue;
      }
      const key = frame.keys[frame.i] as string;
      frame.i++;
      const seg = segment(key);
      const d = Object.getOwnPropertyDescriptor(frame.obj, key);
      if (d === undefined || !("value" in d) || d.enumerable !== true || hasLoneSurrogate(key)) {
        error = notJson(seg);
        break;
      }
      if (emit) {
        if (frame.i > 1) out.push(",");
        out.push(JSON.stringify(key), ":");
      }
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
        if (emit && index > 0) out.push(",");
        error = visit(d.value, seg);
        continue;
      }
      if (frame.extra.length > 0) {
        error = notJson(segment(frame.extra[0] as string));
        break;
      }
      if (emit) out.push("]");
      leave(frame);
    }
  }
  return { error, text: error === null && emit ? out.join("") : "" };
}

/** Canonical form of a JSON value: JCS without changes; strings are not normalised (NFC belongs to checkInput). */
export function canonical(value: unknown): Result<string> {
  const r = walk(value, true, "", {});
  return r.error === null ? ok(r.text) : fail([r.error]);
}
