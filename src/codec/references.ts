// IDs mentioned in a text (REQ-CD-006, design D-5): mentions bounded by characters outside `[A-Za-z0-9-]`, outside
// code spans, and ranges `P-Ln…Lm` / `P-Ln…P-Lm` expanded to every ID between. The text itself is never changed.

export type Mentioned =
  | { readonly ok: true; readonly ids: readonly string[] }
  | { readonly ok: false; readonly offset: number; readonly message: string };

const WORD = /[A-Za-z0-9-]/;
const MENTION = /[A-Z][A-Z0-9]+-[A-Z0-9]+/y; // the ID of the document form (form.ts)
const SHORT_END = /[A-Z]*[0-9]+/y;
const SUFFIX = /^([A-Z]*)([0-9]+)$/;
const RANGE_MARK = "…";
const MAX_RANGE = 100;
const MAX_DIGITS = 9;

/** The offsets inside code spans: a run of backticks up to the next run of exactly as many (CommonMark). */
function codeSpans(text: string): boolean[] {
  const inside = new Array<boolean>(text.length).fill(false);
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "`") {
      i++;
      continue;
    }
    let n = 0;
    while (text[i + n] === "`") n++;
    let j = i + n;
    let close = -1;
    while (j < text.length) {
      if (text[j] !== "`") {
        j++;
        continue;
      }
      let m = 0;
      while (text[j + m] === "`") m++;
      if (m === n) {
        close = j;
        break;
      }
      j += m;
    }
    if (close < 0) {
      i += n;
      continue;
    }
    inside.fill(true, i, close + n);
    i = close + n;
  }
  return inside;
}

/** The run matching `re` at `at`, when no character of `[A-Za-z0-9-]` follows it. */
function bounded(re: RegExp, text: string, at: number): string | null {
  re.lastIndex = at;
  const m = re.exec(text);
  if (m === null) return null;
  const after = text[at + m[0].length];
  return after !== undefined && WORD.test(after) ? null : m[0];
}

/** The IDs of a valid range from `start` (an ID) to `end` (an ID or its suffix), or why it is not one. */
function expand(start: string, end: string): string[] | string {
  const hyphen = start.indexOf("-");
  const prefix = start.slice(0, hyphen);
  let endSuffix = end;
  if (end.includes("-")) {
    if (end.slice(0, end.indexOf("-")) !== prefix) return "the range ends in another prefix";
    endSuffix = end.slice(end.indexOf("-") + 1);
  }
  const a = SUFFIX.exec(start.slice(hyphen + 1));
  const b = SUFFIX.exec(endSuffix);
  if (a === null || b === null) return "a range end is not letters followed by digits";
  const [, letters, from] = a as unknown as [string, string, string];
  const [, endLetters, to] = b as unknown as [string, string, string];
  if (letters !== endLetters) return "the ends of the range have other letters";
  if (from.length !== to.length) return "the ends of the range have another number of digits";
  if (from.length > MAX_DIGITS) return `the numbers of the range have more than ${MAX_DIGITS} digits`;
  const lo = Number(from);
  const hi = Number(to);
  if (lo >= hi) return "the range does not ascend";
  if (hi - lo + 1 > MAX_RANGE) return `the range names more than ${MAX_RANGE} IDs`;
  const ids: string[] = [];
  for (let k = lo; k <= hi; k++) ids.push(`${prefix}-${letters}${String(k).padStart(from.length, "0")}`);
  return ids;
}

/** Every ID the text mentions, in order (repeats kept), or the offset of a malformed range. */
export function mentions(text: string): Mentioned {
  const code = codeSpans(text);
  const ids: string[] = [];
  let i = 0;
  while (i < text.length) {
    const before = i === 0 ? undefined : text[i - 1];
    const id = code[i] || (before !== undefined && WORD.test(before)) ? null : bounded(MENTION, text, i);
    if (id === null || id.length > 128) {
      i++;
      continue;
    }
    let next = i + id.length;
    if (text[next] === RANGE_MARK && /[A-Z0-9]/.test(text[next + 1] ?? "")) {
      const end = bounded(MENTION, text, next + 1) ?? bounded(SHORT_END, text, next + 1);
      const range = end === null ? "the text after … is not the end of a range" : expand(id, end);
      if (typeof range === "string") return { ok: false, offset: i, message: range };
      ids.push(...range);
      next += 1 + (end as string).length;
    } else {
      ids.push(id);
    }
    i = next;
  }
  return { ok: true, ids };
}
