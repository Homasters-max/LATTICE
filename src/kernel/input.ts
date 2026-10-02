// Parsing a JSON text (REQ-KR-009, OM-H02): an own recursive descent over RFC 8259 instead of JSON.parse — duplicate
// keys, number records, lone surrogates and places (JSON Pointer) are visible, depth stops at level 65. A key starting
// with `$` is an ordinary key (NX-15, NX-20).

import type { InputCode, Refusal, Result } from "./types.ts";
import { fail, ok, refusal, segment } from "./types.ts";
import { admitString } from "./strings.ts";

const MAX_DEPTH = 64;
const HEX4 = /^[0-9a-fA-F]{4}$/;
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: String.fromCharCode(8),
  f: String.fromCharCode(12),
  n: String.fromCharCode(10),
  r: String.fromCharCode(13),
  t: String.fromCharCode(9),
};

type Found = { readonly code: InputCode; readonly path: string; readonly pos: number };

function isDigit(c: number): boolean {
  return c >= 0x30 && c <= 0x39;
}

export function checkInput(text: unknown): Result<unknown, InputCode> {
  if (typeof text !== "string") return fail([refusal<InputCode>("syntax", "")]);
  const len = text.length;
  const found: Found[] = [];
  const segs: string[] = [];
  let pos = 0;
  let stop: Refusal<InputCode> | null = null;
  // Inside the value of a member whose key was refused: only syntax and too-deep, at the path of that object.
  let quiet = 0;
  let quietPath = "";

  const path = (): string => segs.join("");
  const report = (code: InputCode, p: string, at: number): void => {
    if (quiet === 0) found.push({ code, path: p, pos: at });
  };
  const syntax = (): undefined => {
    if (stop === null) stop = refusal<InputCode>("syntax", "");
    return undefined;
  };
  const tooDeep = (): undefined => {
    if (stop === null) stop = refusal<InputCode>("too-deep", quiet > 0 ? quietPath : path());
    return undefined;
  };
  const skipWs = (): void => {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) pos++;
      else break;
    }
  };

  /** The decoded string, not yet admitted (`admitString` decides for a key and a value alike). */
  const readString = (): string | undefined => {
    pos++; // opening quote
    const parts: string[] = [];
    let run = pos;
    for (;;) {
      if (pos >= len) return syntax();
      const c = text.charCodeAt(pos);
      if (c === 0x22) {
        parts.push(text.slice(run, pos));
        pos++;
        break;
      }
      if (c === 0x5c) {
        parts.push(text.slice(run, pos));
        const e = text.charAt(pos + 1);
        if (e === "u") {
          const hex = text.slice(pos + 2, pos + 6);
          if (!HEX4.test(hex)) return syntax();
          parts.push(String.fromCharCode(Number("0x" + hex)));
          pos += 6;
        } else {
          const decoded = ESCAPES[e];
          if (decoded === undefined) return syntax();
          parts.push(decoded);
          pos += 2;
        }
        run = pos;
        continue;
      }
      if (c < 0x20) return syntax();
      pos++;
    }
    return parts.join("");
  };

  const parseStringValue = (): unknown => {
    const at = pos;
    const s = readString();
    if (s === undefined) return undefined;
    const a = admitString(s);
    if (!a.ok) {
      report(a.code, path(), at);
      return s;
    }
    return a.nfc;
  };

  const parseNumber = (): unknown => {
    const start = pos;
    if (text.charCodeAt(pos) === 0x2d) pos++;
    if (pos < len && text.charCodeAt(pos) === 0x30) {
      pos++;
    } else if (pos < len && isDigit(text.charCodeAt(pos))) {
      while (pos < len && isDigit(text.charCodeAt(pos))) pos++;
    } else {
      return syntax();
    }
    if (pos < len && text.charCodeAt(pos) === 0x2e) {
      pos++;
      if (!(pos < len && isDigit(text.charCodeAt(pos)))) return syntax();
      while (pos < len && isDigit(text.charCodeAt(pos))) pos++;
    }
    if (pos < len && (text.charCodeAt(pos) === 0x65 || text.charCodeAt(pos) === 0x45)) {
      pos++;
      if (pos < len && (text.charCodeAt(pos) === 0x2b || text.charCodeAt(pos) === 0x2d)) pos++;
      if (!(pos < len && isDigit(text.charCodeAt(pos)))) return syntax();
      while (pos < len && isDigit(text.charCodeAt(pos))) pos++;
    }
    const x = Number(text.slice(start, pos));
    // One refusal per number, by the nearest double: negative-zero, then non-finite, then unsafe-integer.
    if (Object.is(x, -0)) report("negative-zero", path(), start);
    else if (!Number.isFinite(x)) report("non-finite", path(), start);
    else if (Number.isInteger(x) && !Number.isSafeInteger(x)) report("unsafe-integer", path(), start);
    return x;
  };

  const literal = (word: string, value: unknown): unknown => {
    if (!text.startsWith(word, pos)) return syntax();
    pos += word.length;
    return value;
  };

  const parseArray = (level: number): unknown => {
    if (level > MAX_DEPTH) return tooDeep();
    pos++;
    const arr: unknown[] = [];
    skipWs();
    if (pos < len && text.charCodeAt(pos) === 0x5d) {
      pos++;
      return arr;
    }
    for (;;) {
      segs.push("/" + String(arr.length));
      const v = parseValue(level + 1);
      segs.pop();
      if (stop !== null) return undefined;
      arr.push(v);
      skipWs();
      const c = pos < len ? text.charCodeAt(pos) : -1;
      if (c === 0x2c) {
        pos++;
        continue;
      }
      if (c === 0x5d) {
        pos++;
        return arr;
      }
      return syntax();
    }
  };

  const parseObject = (level: number): unknown => {
    if (level > MAX_DEPTH) return tooDeep();
    pos++;
    const obj: Record<string, unknown> = {};
    const objPath = path();
    const seen = new Set<string>();
    skipWs();
    if (pos < len && text.charCodeAt(pos) === 0x7d) {
      pos++;
      return obj;
    }
    for (;;) {
      skipWs();
      if (!(pos < len && text.charCodeAt(pos) === 0x22)) return syntax();
      const keyPos = pos;
      const key = readString();
      if (key === undefined) return undefined;
      skipWs();
      if (!(pos < len && text.charCodeAt(pos) === 0x3a)) return syntax();
      pos++;
      const a = admitString(key);
      if (!a.ok) {
        report(a.code, objPath, keyPos);
        if (quiet === 0) quietPath = objPath;
        quiet++;
        parseValue(level + 1);
        quiet--;
        if (stop !== null) return undefined;
      } else {
        const k = a.nfc;
        const seg = segment(k);
        const duplicate = seen.has(k);
        if (duplicate) report("duplicate-key", objPath + seg, keyPos);
        else seen.add(k);
        segs.push(seg);
        const v = parseValue(level + 1);
        segs.pop();
        if (stop !== null) return undefined;
        if (!duplicate) {
          Object.defineProperty(obj, k, { value: v, enumerable: true, writable: true, configurable: true });
        }
      }
      skipWs();
      const c = pos < len ? text.charCodeAt(pos) : -1;
      if (c === 0x2c) {
        pos++;
        continue;
      }
      if (c === 0x7d) {
        pos++;
        break;
      }
      return syntax();
    }
    return obj;
  };

  const parseValue = (level: number): unknown => {
    skipWs();
    if (pos >= len) return syntax();
    const c = text.charCodeAt(pos);
    if (c === 0x7b) return parseObject(level);
    if (c === 0x5b) return parseArray(level);
    if (c === 0x22) return parseStringValue();
    if (c === 0x74) return literal("true", true);
    if (c === 0x66) return literal("false", false);
    if (c === 0x6e) return literal("null", null);
    if (c === 0x2d || isDigit(c)) return parseNumber();
    return syntax();
  };

  const value = parseValue(1);
  if (stop === null) {
    skipWs();
    if (pos < len) syntax();
  }
  if (stop !== null) return fail([stop]);
  if (found.length > 0) {
    const sorted = found.slice().sort((a, b) => a.pos - b.pos);
    return fail(sorted.map((f) => refusal(f.code, f.path)));
  }
  return ok(value);
}
