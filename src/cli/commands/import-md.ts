// `lattice import-md <file>` (REQ-CL-003): a proposal from a table with IDs.

import { parseArgs } from "node:util";
import { lattice } from "../../assembly/index.ts";
import type { Command } from "../io.ts";
import { report, usageError } from "../io.ts";

export const importMd: Command = {
  name: "import-md",
  summary: "write a proposal from an md file holding one table with IDs: <file>",
  run(args, io) {
    let positionals: string[];
    try {
      ({ positionals } = parseArgs({ args: [...args], options: {}, strict: true, allowPositionals: true }));
    } catch (e) {
      return usageError(io, "import-md", (e as Error).message);
    }
    if (positionals.length !== 1) return usageError(io, "import-md", "exactly one md file is required");
    return report(io, lattice(io.cwd, io.ports).importMd(positionals[0] as string));
  },
};
