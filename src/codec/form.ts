// The document form of `md` (REQ-CD-001, design D-2): the lines of a file read into elements — title, heading, fence,
// table, list, paragraph — separated by exactly one empty line, and elements rendered back. The form stores no layout:
// the layout it accepts is the only one, so rendering the elements of a file gives the file back byte for byte.

import { parseRef } from "../kernel/index.ts";

// An ID of the document form (REQ-CD-001): `[A-Z][A-Z0-9]+-[A-Z0-9]+`, two or more characters before the hyphen; the
// same pattern is the mention of references.ts.
const ID = /^[A-Z][A-Z0-9]+-[A-Z0-9]+$/;
const PARAGRAPH = /^([A-Z][A-Z0-9]+-[A-Z0-9]+)\. ([^]+)$/; // `[^]`: U+2028 and U+2029 are text too
const STARTS_PARAGRAPH = /^[A-Z][A-Z0-9]+-[A-Z0-9]+\. /;
const FENCE = /^```([A-Za-z0-9][A-Za-z0-9_+.-]*) ([A-Z][A-Z0-9]+-[A-Z0-9]+)$/;
const TICKS = "```";

export type Element =
  | { readonly kind: "title"; readonly line: number; readonly text: string }
  | { readonly kind: "heading"; readonly line: number; readonly text: string }
  | { readonly kind: "fence"; readonly line: number; readonly language: string; readonly id: string; readonly text: string }
  | {
      readonly kind: "table";
      readonly line: number;
      readonly header: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly kind: "list"; readonly line: number; readonly items: readonly string[] }
  | { readonly kind: "paragraph"; readonly line: number; readonly id: string; readonly text: string };

/** A refusal of the document form: the line of the first deviation (0 for the file name and the encoding). */
export type Deviation = { readonly line: number; readonly message: string };

type Parsed = { readonly elements: readonly Element[]; readonly deviation: Deviation | null };

/** A local part `namespace/local` the kernel grammar admits (REQ-KR-012: at most 128 characters). */
export function localOk(local: string): boolean {
  const r = parseRef(`x/${local}`);
  return r.ok && r.value.version === undefined;
}

/** An ID of the document form whose entity `id` the kernel admits. */
export function isDocId(text: string): boolean {
  return ID.test(text) && localOk(text.toLowerCase());
}

/** A cell of the document form: no line break, `|` only as `\|`, no leading or trailing space. */
function cellOk(cell: string): boolean {
  return !/[\n\r]/.test(cell) && !/(^|[^\\])\|/.test(cell) && !cell.startsWith(" ") && !cell.endsWith(" ");
}

function renderCells(cells: readonly string[]): string {
  return "| " + cells.join(" | ") + " |";
}

function separator(width: number): string {
  return "|" + "---|".repeat(width);
}

/** The cells of a table line, or null when the line is not one (REQ-CD-001). */
function splitCells(line: string): string[] | null {
  if (line.length < 4 || !line.startsWith("| ") || !line.endsWith(" |")) return null;
  const cells = line.slice(2, -2).split(" | ");
  return cells.every(cellOk) && renderCells(cells) === line ? cells : null;
}

function startsElement(line: string): boolean {
  return /^(#|\||- |```)/.test(line) || STARTS_PARAGRAPH.test(line);
}

/**
 * The elements of a file, read from the top, and the first deviation of its layout or of an element's lines (step 4 of
 * REQ-CD-001), or null. The elements read before a deviation are returned — the one it broke as far as it was read,
 * a table from its header on — so the caller finds an earlier deviation of its own rules in them.
 */
export function parseElements(lines: readonly string[]): Parsed {
  const elements: Element[] = [];
  const stop = (line: number, message: string): Parsed => ({ elements, deviation: { line, message } });
  if (lines.length === 0) return stop(1, "the file has no line");
  let i = 0;
  while (i < lines.length) {
    if (elements.length === 0) {
      if (lines[0] === "") return stop(1, "an empty line at the start of the file");
    } else {
      if (lines[i] !== "") return stop(i + 1, "the line directly after an element is not empty");
      if (i + 1 >= lines.length) return stop(i + 1, "an empty line at the end of the file");
      if (lines[i + 1] === "") return stop(i + 2, "two empty lines in a row");
      i++;
    }
    const first = lines[i] as string;
    const at = i + 1;
    const isTitle = first.startsWith("# ");
    if (elements.length === 0 && !isTitle) return stop(at, "the first element is not a title");
    if (isTitle) {
      if (elements.length > 0) return stop(at, "a second title");
      if (first.length === 2) return stop(at, "the title has no text");
      elements.push({ kind: "title", line: at, text: first.slice(2) });
      i++;
    } else if (first.startsWith("## ")) {
      if (first.length === 3) return stop(at, "the heading has no text");
      elements.push({ kind: "heading", line: at, text: first.slice(3) });
      i++;
    } else if (first.startsWith("#")) {
      return stop(at, "the line is neither a title nor a heading of level 2");
    } else if (first.startsWith(TICKS)) {
      const m = FENCE.exec(first);
      if (m === null || !isDocId(m[2] as string)) return stop(at, "the opening line of a fence is not ```<language> <ID>");
      let j = i + 1;
      while (j < lines.length && lines[j] !== TICKS) j++;
      if (j >= lines.length) return stop(at, "the fence has no closing line");
      const text = lines.slice(i + 1, j).map((l) => l + "\n").join("");
      elements.push({ kind: "fence", line: at, language: m[1] as string, id: m[2] as string, text });
      i = j + 1;
    } else if (first.startsWith("|")) {
      const header = splitCells(first);
      if (header === null) return stop(at, "the line is not | cell | … | of the document form");
      // the table is an element from its header on, so the rules of its header are checked before a later deviation
      const rows: string[][] = [];
      elements.push({ kind: "table", line: at, header, rows });
      if (i + 1 >= lines.length || !(lines[i + 1] as string).startsWith("|")) return stop(at + 1, "the table has no separator line");
      if (lines[i + 1] !== separator(header.length)) return stop(at + 1, "the separator is not |---| once per header cell");
      i += 2;
      while (i < lines.length && (lines[i] as string).startsWith("|")) {
        const cells = splitCells(lines[i] as string);
        if (cells === null) return stop(i + 1, "the line is not | cell | … | of the document form");
        if (cells.length !== header.length) return stop(i + 1, "the row has another number of cells than the header");
        rows.push(cells);
        i++;
      }
      if (rows.length === 0) return stop(at + 2, "the table has no row");
    } else if (first.startsWith("- ")) {
      const items: string[] = [];
      elements.push({ kind: "list", line: at, items });
      while (i < lines.length && (lines[i] as string).startsWith("- ")) {
        const item = (lines[i] as string).slice(2);
        if (item === "") return stop(i + 1, "an empty list item");
        items.push(item);
        i++;
      }
    } else {
      const m = PARAGRAPH.exec(first);
      if (m === null || !isDocId(m[1] as string)) return stop(at, "the line is not a paragraph starting with an ID and '. '");
      let text = m[2] as string;
      i++;
      while (i < lines.length && lines[i] !== "") {
        if (startsElement(lines[i] as string)) {
          elements.push({ kind: "paragraph", line: at, id: m[1] as string, text });
          return stop(i + 1, "the line directly after a paragraph starts another element");
        }
        text += "\n" + (lines[i] as string);
        i++;
      }
      elements.push({ kind: "paragraph", line: at, id: m[1] as string, text });
    }
  }
  return { elements, deviation: null };
}

function renderElement(e: Element): string {
  switch (e.kind) {
    case "title":
      return "# " + e.text;
    case "heading":
      return "## " + e.text;
    case "fence":
      return TICKS + e.language + " " + e.id + "\n" + e.text + TICKS;
    case "table":
      return [renderCells(e.header), separator(e.header.length), ...e.rows.map(renderCells)].join("\n");
    case "list":
      return e.items.map((item) => "- " + item).join("\n");
    case "paragraph":
      return e.id + ". " + e.text;
  }
}

/** The text of a file of these elements: each rendered, separated by one empty line, and a final line feed. */
export function renderElements(elements: readonly Element[]): string {
  return elements.map(renderElement).join("\n\n") + "\n";
}
