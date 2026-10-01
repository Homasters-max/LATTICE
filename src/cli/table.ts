// The command table of `lattice` (PL-E02, REQ-CL-001, design D-8): one file per command in commands/. A new command
// is a row here and a file there.

import type { Command } from "./io.ts";
import { init } from "./commands/init.ts";
import { importMd } from "./commands/import-md.ts";
import { apply } from "./commands/apply.ts";
import { exportCommand } from "./commands/export.ts";

export const COMMANDS: readonly Command[] = [init, importMd, apply, exportCommand];
