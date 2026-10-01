// `lattice apply <proposal file>` (REQ-CL-004): a commit, or rejections naming rule IDs.

import { parseArgs } from "node:util";
import { lattice } from "../../assembly/index.ts";
import type { Command } from "../io.ts";
import { report, usageError } from "../io.ts";

export const apply: Command = {
  name: "apply",
  summary: "apply a proposal of store/proposals/ to the ledger: <proposal file>",
  run(args, io) {
    let positionals: string[];
    try {
      ({ positionals } = parseArgs({ args: [...args], options: {}, strict: true, allowPositionals: true }));
    } catch (e) {
      return usageError(io, "apply", (e as Error).message);
    }
    if (positionals.length !== 1) return usageError(io, "apply", "exactly one proposal file is required");
    return report(io, lattice(io.cwd, io.ports).apply(positionals[0] as string));
  },
};
