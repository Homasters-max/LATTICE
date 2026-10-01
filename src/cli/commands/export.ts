// `lattice export --out <folder>` (REQ-CL-005): md from the latest revisions.

import { parseArgs } from "node:util";
import { lattice } from "../../assembly/index.ts";
import type { Command } from "../io.ts";
import { report, usageError } from "../io.ts";

export const exportCommand: Command = {
  name: "export",
  summary: "render the md of every document from the latest revisions: --out <folder>",
  run(args, io) {
    let out: string | undefined;
    try {
      ({
        values: { out },
      } = parseArgs({ args: [...args], options: { out: { type: "string" } }, strict: true, allowPositionals: false }));
    } catch (e) {
      return usageError(io, "export", (e as Error).message);
    }
    if (out === undefined) return usageError(io, "export", "--out is required");
    return report(io, lattice(io.cwd, io.ports).exportTo(out));
  },
};
