// Adapter `init` of the `acts` port (LG-A04, CT-N05, REQ-AC-002): the owner of the init configuration acts on every
// proposal of store init, and the commit names the configuration as the place of the act.

import type { Act, Acts } from "../../ledger/ports/acts.ts";

export const INIT_REF = "store/lattice.json";

export function initActs(owner: string): Acts {
  return {
    actsOn(proposal: string): readonly Act[] {
      return Object.freeze([Object.freeze({ login: owner, names: Object.freeze([proposal]), ref: INIT_REF })]);
    },
  };
}
