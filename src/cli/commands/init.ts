// `lattice init --namespace <namespace> --owner <login>` (REQ-CL-002): a project store with its first four commits —
// genesis, std, the project namespace and setup@1 with its live fact — written through apply.

import { parseArgs } from "node:util";
import { lattice } from "../../assembly/index.ts";
import type { Command } from "../io.ts";
import { report, usageError } from "../io.ts";

export const init: Command = {
  name: "init",
  summary: "create an empty project store: --namespace <namespace> --owner <login>",
  run(args, io) {
    let values: { namespace?: string; owner?: string };
    try {
      ({ values } = parseArgs({
        args: [...args],
        options: { namespace: { type: "string" }, owner: { type: "string" } },
        strict: true,
        allowPositionals: false,
      }));
    } catch (e) {
      return usageError(io, "init", (e as Error).message);
    }
    if (values.namespace === undefined || values.owner === undefined) {
      return usageError(io, "init", "--namespace and --owner are required");
    }
    return report(io, lattice(io.cwd, io.ports).init(values.namespace, values.owner));
  },
};
