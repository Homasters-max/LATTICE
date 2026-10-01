// Module `codec` (design-next ST-M01, LG-B05): the whole `md` format — import into a proposal, export from the
// latest-revision projection. The walking skeleton knows one form: one table with IDs (design D-6).

export type { Imported, Session } from "./import.ts";
export { importMd } from "./import.ts";
export { stemOf } from "./table.ts";
export type { Exported, ExportedFile } from "./export.ts";
export { exportMd } from "./export.ts";
