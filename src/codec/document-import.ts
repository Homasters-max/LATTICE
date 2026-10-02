// md import of the document form (REQ-CD-001 … REQ-CD-007, design D-2 … D-6): a file becomes a proposal — the session
// event, one entity per block (paragraph, fence, row of a table with IDs), one composition per section and one for the
// document. The checks run in four steps; the first deviation is refused with its line, never repaired.

import type { Id } from "../kernel/index.ts";
import { checkInput } from "../kernel/index.ts";
import type { Intent } from "../ledger/index.ts";
import { SESSION_TYPE } from "../ledger/index.ts";
import type { Deviation, Element } from "./form.ts";
import { isDocId, localOk, parseElements } from "./form.ts";
import type { Imported, Session } from "./import.ts";
import { mentions } from "./references.ts";
import { columnsProblem, slug, stemOf, typeLocal } from "./table.ts";

/** Column names a row body uses for its own fields (REQ-CD-003). */
const RESERVED = ["refs", "table", "list"];

// The local parts of the codec types in the project namespace (design D-3); export reads them back.
export const PARAGRAPH_TYPE = "paragraph@1";
export const EXAMPLE_TYPE = "example@1";
export const SECTION_TYPE = "section@1";
export const DOCUMENT_TYPE = "document@2";
export const ROW_REVISION = 2;

/** An item of a composition (REQ-CD-007): the `id` of a block or a section, or a table with IDs. */
type Item = string | { readonly columns: readonly string[]; readonly rows: readonly string[] };

/** A block being built: its body, the IDs its texts mention, and the text that decides whether a field may follow. */
type Block = {
  readonly id: string;
  readonly type: string;
  readonly body: Record<string, unknown>;
  readonly mentioned: string[];
  readonly lead: string | null;
};

// `build` checks its rules deep inside the walk over the elements; the first deviation leaves it as this exception,
// caught only in `importDocument` and turned back into a refusal value, so the interface answers values as `importMd`.
class Refused extends Error {
  readonly deviation: Deviation;
  constructor(deviation: Deviation) {
    super(deviation.message);
    this.deviation = deviation;
  }
}

const refused = (line: number, message: string): Imported => ({ ok: false, line, message });

/** Steps 1–3 of REQ-CD-001: the file name, the lines, the code points; the lines of the file, or the refusal. */
function lines(text: string, fileName: string): { stem: string; lines: string[] } | Deviation {
  const stem = stemOf(fileName);
  if (stem === null) return { line: 0, message: "the file name is not <stem>.md of the form" };
  if (text.startsWith("\uFEFF")) return { line: 0, message: "the file starts with a byte order mark" };
  const raw = text.split("\n");
  const cr = raw.findIndex((l) => l.includes("\r"));
  const unterminated = raw[raw.length - 1] === "" ? -1 : raw.length - 1;
  const bad = [cr, unterminated].filter((i) => i >= 0);
  if (bad.length > 0) {
    const i = Math.min(...bad);
    return { line: i + 1, message: i === cr ? "the line holds a carriage return" : "the last line has no line feed" };
  }
  const all = raw.slice(0, -1);
  for (const [i, line] of all.entries()) {
    if (line.normalize("NFC") !== line) return { line: i + 1, message: "the line is not in NFC" };
    if (!checkInput(JSON.stringify(line)).ok) return { line: i + 1, message: "the line holds a code point the kernel refuses" };
  }
  return { stem, lines: all };
}

/** Builds the entities of the elements in order (step 4); throws `Refused` at the first deviation of their rules. */
function build(elements: readonly Element[], stem: string, namespace: string) {
  const name = (local: string): string => `${namespace}/${local}`;
  const blocks: Block[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const headers = new Map<string, string>();
  const sections: { id: string; heading: string; items: Item[] }[] = [];
  const docItems: Item[] = [];
  let title = "";
  let owner: Block | null = null;
  const items = (): Item[] => sections.at(-1)?.items ?? docItems;

  const claim = (id: string, line: number): string => {
    if (!isDocId(id)) throw new Refused({ line, message: "the cell is not an ID" });
    if (ids.has(id)) throw new Refused({ line, message: `the ID ${id} is not unique in the file` });
    if (id.toLowerCase() === stem) throw new Refused({ line, message: "the ID in lower case equals the file stem" });
    ids.add(id);
    return name(id.toLowerCase());
  };
  const mention = (block: Block, text: string, line: number): void => {
    const m = mentions(text);
    if (!m.ok) {
      const lineOf = line + (text.slice(0, m.offset).match(/\n/g)?.length ?? 0);
      throw new Refused({ line: lineOf, message: m.message });
    }
    block.mentioned.push(...m.ids);
  };
  const field = (line: number): Block => {
    if (owner === null || owner.lead === null || !owner.lead.endsWith(":")) {
      throw new Refused({ line, message: "a table without IDs or a list follows no block whose text ends with ':'" });
    }
    return owner;
  };

  for (const e of elements) {
    let next: Block | null = null;
    switch (e.kind) {
      case "title":
        title = e.text;
        break;
      case "heading": {
        const s = slug(e.text);
        if (s === "") throw new Refused({ line: e.line, message: "the heading gives an empty slug" });
        if (slugs.has(s)) throw new Refused({ line: e.line, message: `the slug ${s} of the heading repeats` });
        if (!localOk(`${stem}.${s}`)) throw new Refused({ line: e.line, message: "the section id is longer than the kernel admits" });
        slugs.add(s);
        const id = name(`${stem}.${s}`);
        docItems.push(id);
        sections.push({ id, heading: e.text, items: [] });
        break;
      }
      case "fence": {
        const id = claim(e.id, e.line);
        blocks.push({ id, type: name(EXAMPLE_TYPE), body: { language: e.language, text: e.text }, mentioned: [], lead: null });
        items().push(id);
        break;
      }
      case "paragraph": {
        const id = claim(e.id, e.line);
        const block: Block = { id, type: name(PARAGRAPH_TYPE), body: { text: e.text }, mentioned: [], lead: e.text };
        mention(block, e.text, e.line);
        blocks.push(block);
        items().push(id);
        next = block;
        break;
      }
      case "table": {
        if (e.header[0] !== "ID") {
          const block = field(e.line);
          block.body.table = { header: e.header, rows: e.rows };
          for (const cell of e.header) mention(block, cell, e.line);
          for (const [k, row] of e.rows.entries()) for (const cell of row) mention(block, cell, e.line + 2 + k);
          break;
        }
        const columns = e.header.slice(1);
        const problem = columnsProblem(columns) ?? (columns.some((c) => RESERVED.includes(c)) ? "a column is refs, table or list" : null);
        if (problem !== null) throw new Refused({ line: e.line, message: problem });
        const local = typeLocal(columns);
        const earlier = headers.get(local);
        if (earlier !== undefined && earlier !== JSON.stringify(columns)) {
          throw new Refused({ line: e.line, message: "the header gives the slugs of an earlier header with other cells" });
        }
        headers.set(local, JSON.stringify(columns));
        const rowIds: string[] = [];
        for (const [k, row] of e.rows.entries()) {
          const line = e.line + 2 + k;
          const id = claim(row[0] as string, line);
          const body: Record<string, unknown> = Object.fromEntries(columns.map((c, j) => [c, row[j + 1] as string]));
          const block: Block = { id, type: name(`${local}@${ROW_REVISION}`), body, mentioned: [], lead: row.at(-1) as string };
          for (const cell of row.slice(1)) mention(block, cell, line);
          blocks.push(block);
          rowIds.push(id);
          next = block;
        }
        items().push({ columns, rows: rowIds });
        break;
      }
      case "list": {
        const block = field(e.line);
        block.body.list = e.items;
        for (const [k, item] of e.items.entries()) mention(block, item, e.line + k);
        break;
      }
    }
    owner = next;
  }

  for (const b of blocks) {
    if (b.lead === null) continue; // an example has no references (REQ-CD-005)
    const refs = [...new Set(b.mentioned.map((x) => name(x.toLowerCase())))].filter((x) => x !== b.id);
    b.body.refs = refs;
  }
  return { blocks, sections, docItems, title };
}

export function importDocument(text: string, fileName: string, namespace: string, session: Session): Imported {
  const read = lines(text, fileName);
  if ("message" in read) return refused(read.line, read.message);
  const { stem } = read;
  const parsed = parseElements(read.lines);
  let built: ReturnType<typeof build> | null = null;
  let deviation = parsed.deviation;
  try {
    built = build(parsed.elements, stem, namespace);
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    if (deviation === null || e.deviation.line < deviation.line) deviation = e.deviation;
  }
  if (deviation !== null) return refused(deviation.line, deviation.message);
  if (built === null) throw new Error("unreachable: no deviation and no entities");

  const entity = (id: string, type: string, body: unknown): Intent => ({
    kind: "entity",
    id: id as Id,
    type,
    base: 0,
    by: session.id,
    body,
  });
  const intents: Intent[] = built.blocks.map((b) => entity(b.id, b.type, b.body));
  for (const s of built.sections) intents.push(entity(s.id, `${namespace}/${SECTION_TYPE}`, { heading: s.heading, items: s.items }));
  intents.push(entity(`${namespace}/${stem}`, `${namespace}/${DOCUMENT_TYPE}`, { file: fileName, title: built.title, items: built.docItems }));
  const event = {
    kind: "event",
    id: session.id,
    type: SESSION_TYPE,
    by: session.id,
    at: session.at,
    body: { of: {}, participant: "lattice", kind: "machine", purpose: "import" },
  } as const;
  intents.push(event);
  return { ok: true, proposal: { intents, session: event } };
}
