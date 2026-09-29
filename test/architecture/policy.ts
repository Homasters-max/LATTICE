// Structure policy of the project (REQ-AR-001, design D-1): the sources, the kernel entry and the kernel perimeter as
// data. It changes only together with REQ-AR-001.

import type { Policy } from "./structure.ts";

export const projectPolicy: Policy = {
  sources: ["src/**"],
  entry: "src/kernel/index.ts",
  perimeter: ["src/kernel/**"],
};
