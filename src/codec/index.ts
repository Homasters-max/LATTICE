// Module `codec` (design-next ST-M01, LG-B05): the whole `md` format — import into a proposal, export from the
// latest-revision projection. Two forms: the skeleton form, one table with IDs (skeleton design D-6), read and written by
// the CLI; and the document form of every md form of LG-B06 (REQ-CD-001 … REQ-CD-008, design D-1 of s0-codec-forms).

export type { Imported, Session } from "./import.ts";
export { importMd } from "./import.ts";
export { stemOf } from "./table.ts";
export type { Exported, ExportedFile } from "./export.ts";
export { exportMd } from "./export.ts";
export { importDocument } from "./document-import.ts";
export { exportDocuments } from "./document-export.ts";
