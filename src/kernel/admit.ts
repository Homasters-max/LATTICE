// Admission of a string (REQ-KR-002, REQ-KR-003): lone surrogates and code points unassigned in Unicode 16.0. The
// table itself lives in unicode16.ts; canonical takes only the surrogate predicate, checkInput the whole admission.

import { isAssigned16 } from "./unicode16.ts";

/** Verdict on a decoded string of the input: its NFC form, or the first refusal in the order of REQ-KR-002. */
export type Admission =
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
export function admit(s: string): Admission {
  if (hasLoneSurrogate(s)) return { ok: false, code: "lone-surrogate" };
  for (const ch of s) {
    if (!isAssigned16(ch.codePointAt(0) as number)) return { ok: false, code: "unassigned" };
  }
  return { ok: true, nfc: s.normalize("NFC") };
}
