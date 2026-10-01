// md export (LG-B05, REQ-CL-005, design D-6): every document entity of the latest-revision projection rendered in the
// skeleton form, reading entities only through the read view (LG-J01, PL-K05). Every refusal is found before anything
// is returned, so the caller writes every file or none.

import { parseRef } from "../kernel/index.ts";
import type { EntityRecord, ReadView } from "../ledger/index.ts";
import { cellOk, columnsProblem, isId, renderTable, stemOf } from "./table.ts";

export type ExportedFile = { readonly file: string; readonly text: string };

export type Exported =
  | { readonly ok: true; readonly files: readonly ExportedFile[] }
  | { readonly ok: false; readonly message: string };

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactly(value: unknown, keys: readonly string[]): value is Readonly<Record<string, unknown>> {
  return isObject(value) && Object.keys(value).length === keys.length && keys.every((k) => Object.hasOwn(value, k));
}

/** The rendered file of one document, or why it is refused. */
function render(doc: EntityRecord, view: ReadView): ExportedFile | string {
  const body = doc.body;
  if (!hasExactly(body, ["file", "columns", "rows"])) return "the body is not exactly file, columns and rows";
  const { file, columns, rows } = body;
  if (typeof file !== "string" || stemOf(file) === null) return "file is not <stem>.md of the form";
  if (!Array.isArray(columns) || !columns.every((c): c is string => typeof c === "string")) {
    return "columns is not a list of strings";
  }
  const problem = columnsProblem(columns);
  if (problem !== null) return problem;
  if (!Array.isArray(rows) || rows.length === 0) return "rows is not a non-empty list";
  const out: string[][] = [];
  const ids = new Set<string>();
  for (const ref of rows) {
    if (!hasExactly(ref, ["$ref"]) || typeof ref.$ref !== "string") return "a row is not exactly {$ref}";
    const parsed = parseRef(ref.$ref);
    if (!parsed.ok || parsed.value.version !== undefined) return `the row reference ${ref.$ref} is not floating`;
    const entity = view.get(ref.$ref);
    if (entity === undefined) return `the row reference ${ref.$ref} names no entity`;
    const id = entity.id.slice(entity.id.indexOf("/") + 1).toUpperCase();
    if (!isId(id)) return `the row ${entity.id} does not render an ID`;
    if (ids.has(id)) return `two rows render the ID ${id}`;
    ids.add(id);
    const cells: string[] = [id];
    for (const column of columns) {
      const value = isObject(entity.body) ? entity.body[column] : undefined;
      if (typeof value !== "string") return `the row ${entity.id} has no string field ${column}`;
      if (!cellOk(value)) return `the field ${column} of ${entity.id} breaks the skeleton form`;
      cells.push(value);
    }
    out.push(cells);
  }
  return { file, text: renderTable(["ID", ...columns], out) };
}

export function exportMd(view: ReadView, namespace: string): Exported {
  const type = `${namespace}/document@1`;
  const files: ExportedFile[] = [];
  const names = new Set<string>();
  for (const doc of view.entities()) {
    if (doc.type !== type) continue;
    const r = render(doc, view);
    if (typeof r === "string") return { ok: false, message: `${doc.id}: ${r}` };
    const lower = r.file.toLowerCase();
    if (names.has(lower)) return { ok: false, message: `${doc.id}: another document names the file ${r.file}` };
    names.add(lower);
    files.push(r);
  }
  files.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return { ok: true, files };
}
