// Strings of the kernel (REQ-KR-009, REQ-KR-013): lone surrogates, code points unassigned in Unicode 16.0, NFC, and
// the UTF-8 length of a string. The table itself lives in unicode16.ts.

import { isAssigned16 } from "./unicode16.ts";

/** Verdict on a decoded string of the input: its NFC form, or the first refusal in the order of REQ-KR-009. */
export type StringAdmission =
  | { readonly ok: true; readonly nfc: string }
  | { readonly ok: false; readonly code: "lone-surrogate" | "unassigned" };

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

/** Admit a string of the input: no lone surrogate, then every code point assigned; NFC only when admitted. */
export function admitString(s: string): StringAdmission {
  if (hasLoneSurrogate(s)) return { ok: false, code: "lone-surrogate" };
  for (const ch of s) {
    if (!isAssigned16(ch.codePointAt(0) as number)) return { ok: false, code: "unassigned" };
  }
  return { ok: true, nfc: s.normalize("NFC") };
}

/** Bytes of the UTF-8 encoding of a string without lone surrogates (a pair is one code point of 4 bytes). */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** Number of code points of a string. */
export function codePoints(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}
