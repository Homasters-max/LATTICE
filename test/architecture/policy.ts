// Structure policy of the project (REQ-AR-005, REQ-AR-009, design D-3): the sources, the kernel entry, the kernel
// perimeter and the module matrix of design-next ST-M01 as data. It changes only together with REQ-AR-005 and
// REQ-AR-009.

import type { Module, Modules, Policy } from "./structure.ts";

const pure = (name: string, imports: readonly string[]): Module => ({
  name,
  files: `src/${name}/**`,
  imports,
  builtins: false,
  packages: false,
});

/** ST-M01 at the granularity of modules; the finer limits on reads of `ledger` are #76 (design I-3). */
export const projectModules: Modules = {
  list: [
    pure("kernel", []),
    pure("trust", ["kernel"]),
    pure("measure", ["kernel"]),
    pure("ledger", ["kernel", "trust", "measure"]),
    pure("codec", ["kernel", "ledger"]),
    pure("runtime", ["kernel", "ledger"]),
    pure("capabilities", ["kernel", "measure", "ledger", "runtime:ports"]),
    {
      name: "assembly",
      files: "src/assembly/**",
      imports: ["kernel", "trust", "measure", "ledger", "codec", "runtime", "capabilities", "adapters"],
      builtins: true,
      packages: false,
    },
    { name: "cli", files: "src/cli/**", imports: ["assembly"], builtins: true, packages: false },
  ],
  ports: {
    store: "src/ledger/ports/store.ts",
    acts: "src/ledger/ports/acts.ts",
    clock: "src/runtime/ports/clock.ts",
    ids: "src/runtime/ports/ids.ts",
  },
};

export const projectPolicy: Policy = {
  sources: ["src/**"],
  entry: "src/kernel/index.ts",
  perimeter: ["src/kernel/**"],
  modules: projectModules,
};
