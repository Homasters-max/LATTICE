// Input check of a body (REQ-KR-002, design D-1): an own recursive descent over RFC 8259 instead of JSON.parse —
// duplicate keys, number records, lone surrogates and places (JSON Pointer) are visible, depth stops at level 65.

import type { Refusal, Result } from "./types.ts";
import { fail, ok, refusal, segment } from "./types.ts";
import { hasLoneSurrogate } from "./canonical.ts";
import { parseRef } from "./ref.ts";
import { isAssigned16 } from "./unicode16.ts";

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

type Found = { readonly code: string; readonly path: string; readonly pos: number };
type Decoded = { readonly s: string; readonly lone: boolean; readonly unassigned: boolean };

function hasUnassigned(s: string): boolean {
  for (const ch of s) {
    if (!isAssigned16(ch.codePointAt(0) as number)) return true;
  }
  return false;
}

function isDigit(c: number): boolean {
  return c >= 0x30 && c <= 0x39;
}

export function checkInput(text: unknown): Result<unknown> {
  if (typeof text !== "string") return fail([refusal("syntax", "")]);
  const len = text.length;
  const found: Found[] = [];
  const segs: string[] = [];
  let pos = 0;
  let stop: Refusal | null = null;
  // Inside the value of a member whose key was refused: only syntax and too-deep, at the path of that object.
  let quiet = 0;
  let quietPath = "";
  let lastStringRejected = false;

  const path = (): string => segs.join("");
  const report = (code: string, p: string, at: number): void => {
    if (quiet === 0) found.push({ code, path: p, pos: at });
  };
  const syntax = (): undefined => {
    if (stop === null) stop = refusal("syntax", "");
    return undefined;
  };
  const tooDeep = (): undefined => {
    if (stop === null) stop = refusal("too-deep", quiet > 0 ? quietPath : path());
    return undefined;
  };
  const skipWs = (): void => {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) pos++;
      else break;
    }
  };

  const readString = (): Decoded | undefined => {
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
    const s = parts.join("");
    const lone = hasLoneSurrogate(s);
    return { s, lone, unassigned: !lone && hasUnassigned(s) };
  };

  const parseStringValue = (): unknown => {
    const at = pos;
    const d = readString();
    if (d === undefined) return undefined;
    if (d.lone || d.unassigned) {
      report(d.lone ? "lone-surrogate" : "unassigned", path(), at);
      lastStringRejected = true;
      return d.s;
    }
    lastStringRejected = false;
    return d.s.normalize("NFC");
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
    let encSeen = false;
    let refPos = -1;
    let refValue: unknown;
    let refRejected = false;
    let otherKeys = 0;
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
      if (key.lone || key.unassigned) {
        report(key.lone ? "lone-surrogate" : "unassigned", objPath, keyPos);
        otherKeys++;
        if (quiet === 0) quietPath = objPath;
        quiet++;
        parseValue(level + 1);
        quiet--;
        if (stop !== null) return undefined;
      } else {
        const k = key.s.normalize("NFC");
        const seg = segment(k);
        const duplicate = seen.has(k);
        if (duplicate) report("duplicate-key", objPath + seg, keyPos);
        else seen.add(k);
        if (k === "$enc" && !encSeen) {
          encSeen = true;
          report("reserved-enc", objPath, keyPos);
        }
        const firstRef = k === "$ref" && refPos < 0;
        if (firstRef) refPos = keyPos;
        else if (k !== "$ref") otherKeys++;
        segs.push(seg);
        const v = parseValue(level + 1);
        segs.pop();
        if (stop !== null) return undefined;
        if (firstRef) {
          refValue = v;
          refRejected = typeof v === "string" && lastStringRejected;
        }
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
    if (refPos >= 0) {
      const bad =
        otherKeys > 0 || typeof refValue !== "string" || refRejected || !parseRef(refValue).ok;
      if (bad) report("bad-ref", objPath, refPos);
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
