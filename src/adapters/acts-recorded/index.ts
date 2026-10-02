// Adapter `recorded` of the `acts` port (LG-A05, REQ-AC-004): the act records of stored commits. It answers the acts of
// every commit whose `proposal` is the asked hash and that name it or an intent `id`; it never calls a service.

import type { Act, Acts } from "../../ledger/ports/acts.ts";

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v !== "";

function actForm(a: unknown): a is Act {
  if (typeof a !== "object" || a === null || Array.isArray(a)) return false;
  if (Object.keys(a).sort().join(",") !== "login,names,ref") return false;
  const x = a as Record<string, unknown>;
  return nonEmpty(x.login) && nonEmpty(x.ref) && Array.isArray(x.names) && x.names.length > 0 && x.names.every(nonEmpty);
}

/** The `proposal` and the act record of a commit text, or `null` when the text is not of that form. */
function recordOf(text: string): { proposal: string; acts: readonly Act[] } | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.proposal !== "string") return null;
  if (!Object.hasOwn(v, "acts")) return { proposal: v.proposal, acts: [] };
  if (!Array.isArray(v.acts) || v.acts.length === 0 || !v.acts.every(actForm)) return null;
  return { proposal: v.proposal, acts: v.acts as Act[] };
}

export function recordedActs(commits: readonly string[]): Acts {
  const records = commits.map(recordOf).filter((r) => r !== null);
  return {
    actsOn(proposal: string): readonly Act[] {
      const out: Act[] = [];
      for (const r of records) {
        if (r.proposal !== proposal) continue;
        for (const a of r.acts) {
          if (!a.names.some((n) => n === proposal || n.includes("/"))) continue;
          out.push(Object.freeze({ login: a.login, names: Object.freeze([...a.names]), ref: a.ref }));
        }
      }
      return Object.freeze(out);
    },
  };
}
