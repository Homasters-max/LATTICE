// The skeleton form of `md` (REQ-CL-003, design D-6): one table, every line exactly `| ` + cells joined by ` | ` + ` |`.
// A line is accepted only when rendering its cells gives it back, so whatever import accepts, export writes back byte
// for byte. The checks shared by import and export live here.

export const MAX_LOCAL = 128; // the kernel `local` grammar (REQ-KR-005)

const STEM = /^([A-Za-z0-9][A-Za-z0-9._-]*)\.md$/;
const STEM_LOWER = /^[a-z0-9][a-z0-9.-]*$/;
const ID = /^[A-Z][A-Z0-9]*-[A-Z0-9]+$/;

export function renderLine(cells: readonly string[]): string {
  return "| " + cells.join(" | ") + " |";
}

/** The cells of a line in the skeleton form, or null (step 4 of REQ-CL-003). */
export function splitLine(line: string): string[] | null {
  if (line.length < 4 || !line.startsWith("| ") || !line.endsWith(" |")) return null;
  const cells = line.slice(2, -2).split(" | ");
  if (cells.some((c) => !cellOk(c))) return null;
  return renderLine(cells) === line ? cells : null;
}

/** A cell the form can hold: no `|`, line feed or carriage return, no leading or trailing space. */
export function cellOk(cell: string): boolean {
  return !/[|\n\r]/.test(cell) && !cell.startsWith(" ") && !cell.endsWith(" ");
}

export function renderTable(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, header.map(() => "---"), ...rows].map(renderLine).join("\n") + "\n";
}

/** The lower-cased stem of a file name `<stem>.md` (step 1 of REQ-CL-003), or null. */
export function stemOf(fileName: string): string | null {
  const m = STEM.exec(fileName);
  const lower = m?.[1]?.toLowerCase();
  return lower !== undefined && STEM_LOWER.test(lower) && lower.length <= MAX_LOCAL ? lower : null;
}

export function isId(cell: string): boolean {
  return ID.test(cell) && cell.length <= MAX_LOCAL;
}

/** The slug of a header cell: lower case, runs outside `[a-z0-9]` as `-`, no leading or trailing `-`. */
export function slug(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Why the header cells after `ID` break step 5 of REQ-CL-003, or null; on success also the type local part. */
export function columnsProblem(columns: readonly string[]): string | null {
  if (columns.length === 0) return "the header has no cell after ID";
  if (columns.some((c) => c === "" || c === "ID" || c.startsWith("$"))) {
    return "a header cell after ID is empty, ID, or starts with $";
  }
  if (new Set(columns).size !== columns.length) return "the header cells are not distinct";
  const slugs = columns.map(slug);
  if (slugs.some((s) => s === "")) return "a header cell gives an empty slug";
  if (new Set(slugs).size !== slugs.length) return "the slugs of the header cells are not distinct";
  if (typeLocal(columns).length > MAX_LOCAL) return "the row type is longer than 128 characters";
  return null;
}

/** The local part of the row type of a header: `table.<slugs>` (REQ-CL-003). */
export function typeLocal(columns: readonly string[]): string {
  return "table." + columns.map(slug).join(".");
}
