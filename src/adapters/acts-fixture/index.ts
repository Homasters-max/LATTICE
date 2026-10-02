// Adapter `fixture` of the `acts` port (LG-A04, REQ-AC-003): acts written in a test. It answers the acts that name the
// asked hash or an intent `id` (a name holding `/`); apply decides which ids are intents of the proposal.

import type { Act, Acts } from "../../ledger/ports/acts.ts";

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v !== "";

function actForm(a: unknown): a is Act {
  if (typeof a !== "object" || a === null || Array.isArray(a)) return false;
  const keys = Object.keys(a).sort();
  if (keys.join(",") !== "login,names,ref") return false;
  const x = a as Record<string, unknown>;
  return nonEmpty(x.login) && nonEmpty(x.ref) && Array.isArray(x.names) && x.names.length > 0 && x.names.every(nonEmpty);
}

export function fixtureActs(acts: readonly unknown[]): Acts {
  const kept: Act[] = acts.map((a, i) => {
    if (!actForm(a)) throw new Error(`fixture act ${i}: not an act {login, names, ref} of non-empty strings`);
    return Object.freeze({ login: a.login, names: Object.freeze([...a.names]), ref: a.ref });
  });
  return {
    actsOn(proposal: string): readonly Act[] {
      return Object.freeze(kept.filter((a) => a.names.some((n) => n === proposal || n.includes("/"))));
    },
  };
}
