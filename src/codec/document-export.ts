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

function isStrings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

// A document that cannot be rendered leaves the walk over its items as this exception, caught only in
// `exportDocuments` and turned into a refusal value.
class CannotRender extends Error {}

function fail(why: string): never {
  throw new CannotRender(why);
}

/** The upper-case ID of an entity `id` `namespace/local` (LG-B06). */
function label(id: string): string {
  return id.slice(id.indexOf("/") + 1).toUpperCase();
}

/** Renders one document, collecting the elements and every entity read for them. */
class Renderer {
  readonly elements: Element[] = [];
  readonly read: EntityRecord[] = [];
  private readonly view: ReadView;
  private readonly namespace: string;

  constructor(view: ReadView, namespace: string) {
    this.view = view;
    this.namespace = namespace;
  }

  private type(local: string): string {
    return `${this.namespace}/${local}`;
  }

  private entity(id: string): EntityRecord {
    const e = this.view.get(id);
    if (e === undefined) return fail(`${id} names no entity`);
    this.read.push(e);
    return e;
  }

  /** The field of a block (REQ-CD-004), written right after it. */
  private field(owner: string, body: Obj): void {
    if (Object.hasOwn(body, "table")) {
      const t = body.table;
      if (!shaped(t, ["header", "rows"]) || !isStrings(t.header) || !Array.isArray(t.rows) || !t.rows.every(isStrings)) {
        return fail(`the field table of ${owner} is not {header, rows} of strings`);
      }
      this.elements.push({ kind: "table", line: 0, header: t.header, rows: t.rows });
    }
    if (Object.hasOwn(body, "list")) {
      if (!isStrings(body.list)) return fail(`the field list of ${owner} is not a list of strings`);
      this.elements.push({ kind: "list", line: 0, items: body.list });
    }
  }

  /** An item of a composition (REQ-CD-007): a block or, in the document, a section, by `id`; or a table with IDs. */
  item(value: unknown, inDocument: boolean): void {
    if (typeof value !== "string") return this.table(value);
    const e = this.entity(value);
    const body = e.body;
    if (e.type === this.type(PARAGRAPH_TYPE)) {
      if (!shaped(body, ["text", "refs"], ["table", "list"]) || typeof body.text !== "string" || !isStrings(body.refs)) {
        return fail(`${e.id} is not a paragraph body`);
      }
      this.elements.push({ kind: "paragraph", line: 0, id: label(e.id), text: body.text });
      this.field(e.id, body);
    } else if (e.type === this.type(EXAMPLE_TYPE)) {
      if (!shaped(body, ["language", "text"]) || typeof body.language !== "string" || typeof body.text !== "string") {
        return fail(`${e.id} is not an example body`);
      }
      this.elements.push({ kind: "fence", line: 0, language: body.language, id: label(e.id), text: body.text });
    } else if (e.type === this.type(SECTION_TYPE) && inDocument) {
      if (!shaped(body, ["heading", "items"]) || typeof body.heading !== "string" || !Array.isArray(body.items)) {
        return fail(`${e.id} is not a section body`);
      }
      this.elements.push({ kind: "heading", line: 0, text: body.heading });
      for (const x of body.items) this.item(x, false);
    } else {
      fail(`the item ${e.id} has the type ${e.type}, which this composition cannot hold`);
    }
  }

  private table(value: unknown): void {
    if (!shaped(value, ["columns", "rows"]) || !isStrings(value.columns) || !isStrings(value.rows) || value.rows.length === 0) {
      return fail("an item is neither an id nor {columns, rows}");
    }
    const columns = value.columns;
    const rowType = this.type(`${typeLocal(columns)}@${ROW_REVISION}`);
    const rows: string[][] = [];
    let last: EntityRecord | null = null;
    for (const id of value.rows) {
      const e = this.entity(id);
      const body = e.body;
      if (e.type !== rowType || !isObject(body)) return fail(`the row ${id} is not of the type ${rowType}`);
      const cells = columns.map((c) => body[c]);
      if (!isStrings(cells)) return fail(`the row ${id} has no string field for every column`);
      rows.push([label(id), ...cells]);
      last = e;
    }
    this.elements.push({ kind: "table", line: 0, header: ["ID", ...columns], rows });
    if (last !== null) this.field(last.id, last.body as Obj);
  }
}

/** The file of one document and the entities read for it; throws `CannotRender`. */
function render(doc: EntityRecord, view: ReadView, namespace: string): { file: string; text: string; read: EntityRecord[] } {
  const body = doc.body;
  if (!shaped(body, ["file", "title", "items"]) || typeof body.file !== "string" || typeof body.title !== "string" || !Array.isArray(body.items)) {
    return fail("the body is not exactly file, title and items");
  }
  if (stemOf(body.file) === null) fail("file is not <stem>.md of the form");
  const r = new Renderer(view, namespace);
  r.read.push(doc);
  r.elements.push({ kind: "title", line: 0, text: body.title });
  for (const x of body.items) r.item(x, true);
  return { file: body.file, text: renderElements(r.elements), read: r.read };
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
  const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const docs = view
    .entities()
    .filter((e) => e.type === docType)
    .sort((a, b) => order(fileOf(a), fileOf(b)) || order(a.id, b.id));
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
