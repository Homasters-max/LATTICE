// md export of the document form (REQ-CD-008, design D-7): every document of the latest-revision projection rendered
// back to its file, reading entities only through the read view (LG-J01). Each rendering is imported again and must
// give back exactly the entities it read, so whatever export writes, import accepts and gives back.

import type { Id } from "../kernel/index.ts";
import { canonical } from "../kernel/index.ts";
import type { EntityRecord, ReadView } from "../ledger/index.ts";
import { DOCUMENT_TYPE, EXAMPLE_TYPE, importDocument, PARAGRAPH_TYPE, ROW_REVISION, SECTION_TYPE } from "./document-import.ts";
import type { Exported, ExportedFile } from "./export.ts";
import type { Element } from "./form.ts";
import { renderElements } from "./form.ts";
import { stemOf, typeLocal } from "./table.ts";

type Obj = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An object whose keys are all of `required` and some of `optional`. */
function shaped(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Obj {
  return (
    isObject(value) &&
    required.every((k) => Object.hasOwn(value, k)) &&
    Object.keys(value).every((k) => required.includes(k) || optional.includes(k))
  );
}

const isStrings = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((x) => typeof x === "string");

class CannotRender extends Error {}

/** The elements of one document and the entities they were read from, or why it cannot be rendered. */
function render(doc: EntityRecord, view: ReadView, namespace: string): { file: string; text: string; read: EntityRecord[] } {
  const fail = (why: string): never => {
    throw new CannotRender(why);
  };
  const type = (local: string): string => `${namespace}/${local}`;
  const label = (id: string): string => id.slice(id.indexOf("/") + 1).toUpperCase();
  const read: EntityRecord[] = [doc];
  const elements: Element[] = [];
  const entity = (id: string): EntityRecord => {
    const e = view.get(id);
    if (e === undefined) return fail(`${id} names no entity`);
    read.push(e);
    return e;
  };
  const field = (owner: EntityRecord): void => {
    const body = owner.body as Obj;
    if (Object.hasOwn(body, "table")) {
      const t = body.table;
      if (!shaped(t, ["header", "rows"]) || !isStrings(t.header) || !Array.isArray(t.rows) || !t.rows.every(isStrings)) {
        fail(`the field table of ${owner.id} is not {header, rows} of strings`);
      }
      const { header, rows } = t as { header: string[]; rows: string[][] };
      elements.push({ kind: "table", line: 0, header, rows });
    }
    if (Object.hasOwn(body, "list")) {
      if (!isStrings(body.list)) fail(`the field list of ${owner.id} is not a list of strings`);
      elements.push({ kind: "list", line: 0, items: body.list as string[] });
    }
  };
  const item = (value: unknown, inDocument: boolean): void => {
    if (typeof value === "string") {
      const e = entity(value);
      const body = e.body;
      if (e.type === type(PARAGRAPH_TYPE)) {
        if (!shaped(body, ["text", "refs"], ["table", "list"]) || typeof body.text !== "string" || !isStrings(body.refs)) {
          fail(`${e.id} is not a paragraph body`);
        }
        elements.push({ kind: "paragraph", line: 0, id: label(e.id), text: (body as Obj).text as string });
        field(e);
      } else if (e.type === type(EXAMPLE_TYPE)) {
        if (!shaped(body, ["language", "text"]) || typeof body.language !== "string" || typeof body.text !== "string") {
          fail(`${e.id} is not an example body`);
        }
        const b = body as Obj;
        elements.push({ kind: "fence", line: 0, language: b.language as string, id: label(e.id), text: b.text as string });
      } else if (e.type === type(SECTION_TYPE) && inDocument) {
        if (!shaped(body, ["heading", "items"]) || typeof body.heading !== "string" || !Array.isArray(body.items)) {
          fail(`${e.id} is not a section body`);
        }
        const b = body as Obj;
        elements.push({ kind: "heading", line: 0, text: b.heading as string });
        for (const x of b.items as unknown[]) item(x, false);
      } else {
        fail(`the item ${e.id} has the type ${e.type}, which this composition cannot hold`);
      }
      return;
    }
    if (!shaped(value, ["columns", "rows"]) || !isStrings(value.columns) || !isStrings(value.rows) || value.rows.length === 0) {
      return fail("an item is neither an id nor {columns, rows}");
    }
    const columns = value.columns as string[];
    const rowType = type(`${typeLocal(columns)}@${ROW_REVISION}`);
    const rows: string[][] = [];
    let last: EntityRecord | null = null;
    for (const id of value.rows as string[]) {
      const e = entity(id);
      if (e.type !== rowType || !isObject(e.body)) fail(`the row ${id} is not of the type ${rowType}`);
      const body = e.body as Obj;
      const cells = columns.map((c) => body[c]);
      if (!isStrings(cells)) fail(`the row ${id} has no string field for every column`);
      rows.push([label(id), ...(cells as string[])]);
      last = e;
    }
    elements.push({ kind: "table", line: 0, header: ["ID", ...columns], rows });
    if (last !== null) field(last);
  };

  const body = doc.body;
  if (!shaped(body, ["file", "title", "items"]) || typeof body.file !== "string" || typeof body.title !== "string" || !Array.isArray(body.items)) {
    return fail("the body is not exactly file, title and items");
  }
  if (stemOf(body.file) === null) fail("file is not <stem>.md of the form");
  elements.push({ kind: "title", line: 0, text: body.title });
  for (const x of body.items) item(x, true);
  return { file: body.file, text: renderElements(elements), read };
}

/** Why the import of a rendering does not give back exactly the entities it was read from, or null. */
function readBack(file: string, text: string, read: readonly EntityRecord[], namespace: string): string | null {
  const session = { id: `${namespace}/00000000000000000000000000` as Id, at: "1970-01-01T00:00:00.000Z" };
  const back = importDocument(text, file, namespace, session);
  if (!back.ok) return `the rendering is refused by import at line ${back.line}: ${back.message}`;
  const same = (a: unknown, b: unknown): boolean => {
    const x = canonical(a);
    const y = canonical(b);
    return x.ok && y.ok && x.value === y.value;
  };
  const byId = new Map(read.map((e) => [e.id as string, e]));
  const entities = back.proposal.intents.filter((x) => x.kind === "entity");
  if (entities.length !== byId.size) return "the rendering reads back into another set of entities";
  for (const x of entities) {
    const e = byId.get(x.id);
    if (e === undefined || e.type !== x.type || !same(e.body, x.body)) return `the rendering reads ${x.id} back into another entity`;
  }
  return null;
}

export function exportDocuments(view: ReadView, namespace: string): Exported {
  const docType = `${namespace}/${DOCUMENT_TYPE}`;
  const fileOf = (e: EntityRecord): string => (isObject(e.body) && typeof e.body.file === "string" ? e.body.file : "");
  const docs = view
    .entities()
    .filter((e) => e.type === docType)
    .sort((a, b) => (fileOf(a) < fileOf(b) ? -1 : fileOf(a) > fileOf(b) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const files: ExportedFile[] = [];
  for (const doc of docs) {
    let rendered: ReturnType<typeof render>;
    try {
      rendered = render(doc, view, namespace);
    } catch (e) {
      if (!(e instanceof CannotRender)) throw e;
      return { ok: false, message: `${doc.id}: ${e.message}` };
    }
    const why = readBack(rendered.file, rendered.text, rendered.read, namespace);
    if (why !== null) return { ok: false, message: `${doc.id}: ${why}` };
    files.push({ file: rendered.file, text: rendered.text });
  }
  return { ok: true, files };
}
