// md import (LG-B05, LG-B06, REQ-CL-003, design D-6): a file in the skeleton form becomes a proposal — the session
// event, one entity intent per row and one for the document. The steps run in order, each over the whole file; the
// first deviation is refused with its line. Strict UTF-8 decoding (step 2) runs in `assembly` (design I-4).

import type { Id } from "../kernel/index.ts";
import { checkInput } from "../kernel/index.ts";
import type { Intent, Proposal } from "../ledger/index.ts";
import { SESSION_TYPE } from "../ledger/index.ts";
import { columnsProblem, isId, splitLine, stemOf, typeLocal } from "./table.ts";

export type Session = { readonly id: Id; readonly at: string };

export type Imported =
  | { readonly ok: true; readonly proposal: Proposal }
  | { readonly ok: false; readonly line: number; readonly message: string };

const refused = (line: number, message: string): Imported => ({ ok: false, line, message });

export function importMd(text: string, fileName: string, namespace: string, session: Session): Imported {
  // 1. the file name
  const stem = stemOf(fileName);
  if (stem === null) return refused(0, "the file name is not <stem>.md of the form");
  // 2. lines (the encoding is checked by the caller; a byte order mark survives decoding as U+FEFF)
  if (text.startsWith("\uFEFF")) return refused(0, "the file starts with a byte order mark");
  const raw = text.split("\n");
  const cr = raw.findIndex((l) => l.includes("\r"));
  const unterminated = raw[raw.length - 1] === "" ? -1 : raw.length - 1;
  const bad2 = [cr, unterminated].filter((i) => i >= 0);
  if (bad2.length > 0) {
    const i = Math.min(...bad2);
    return refused(i + 1, i === cr ? "the line holds a carriage return" : "the last line has no line feed");
  }
  const lines = raw.slice(0, -1);
  // 3. header, separator, at least one row
  if (lines.length < 3) return refused(lines.length + 1, lines.length < 2 ? "no separator line" : "no row");
  // 4. every line in the form
  const cells: string[][] = [];
  for (const [i, line] of lines.entries()) {
    const c = splitLine(line);
    if (c === null) return refused(i + 1, "the line is not | cell | … | in the skeleton form");
    cells.push(c);
  }
  // 5. header and separator; rows as wide as the header
  const header = cells[0] as string[];
  if (header.length < 2 || header[0] !== "ID") return refused(1, "the header is not ID and at least one more cell");
  const columns = header.slice(1);
  const problem = columnsProblem(columns);
  if (problem !== null) return refused(1, problem);
  const separator = cells[1] as string[];
  if (separator.length !== header.length || separator.some((c) => c !== "---")) {
    return refused(2, "the separator is not one --- cell per header cell");
  }
  const rows = cells.slice(2);
  for (const [i, row] of rows.entries()) {
    if (row.length !== header.length) return refused(i + 3, "the row has another number of cells than the header");
  }
  // 6. IDs
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const id = row[0] as string;
    if (!isId(id)) return refused(i + 3, "the first cell is not an ID");
    if (seen.has(id)) return refused(i + 3, "the ID is not unique in the file");
    if (id.toLowerCase() === stem) return refused(i + 3, "the ID in lower case equals the file stem");
    seen.add(id);
  }
  // 7. every cell in NFC and admitted by the kernel
  for (const [i, line] of cells.entries()) {
    for (const cell of line) {
      if (cell.normalize("NFC") !== cell) return refused(i + 1, "a cell is not in NFC");
      if (!checkInput(JSON.stringify(cell)).ok) return refused(i + 1, "a cell holds a code point the kernel refuses");
    }
  }

  // every local part passed the kernel grammar above (steps 1, 5, 6), so these are identifiers
  const name = (local: string): Id => `${namespace}/${local}` as Id;
  const rowType = `${namespace}/${typeLocal(columns)}@1`;
  const rowIds = rows.map((row) => name((row[0] as string).toLowerCase()));
  const intents: Intent[] = rows.map((row, i) => ({
    kind: "entity",
    id: rowIds[i] as Id,
    type: rowType,
    base: 0,
    by: session.id,
    body: Object.fromEntries(columns.map((column, j) => [column, row[j + 1] as string])),
  }));
  intents.push({
    kind: "entity",
    id: name(stem),
    type: `${namespace}/document@1`,
    base: 0,
    by: session.id,
    body: { file: fileName, columns, rows: rowIds.map((id) => ({ $ref: id })) },
  });
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
