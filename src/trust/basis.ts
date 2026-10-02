// The basis table (TR-B02, REQ-TR-001, design D-7): the basis of a record in `knowledge` from the body of its session
// event and whether an act confirms it. Only an act lifts a record above `inferred`; the declared kind and purpose
// choose which basis an act gives, and only for a valid session.

/** The four bases of TR-B01 — categories, not a scale (TR-B03). */
export type Basis = "asserted" | "derived" | "observed" | "inferred";

const KINDS: ReadonlySet<unknown> = new Set(["human", "agent", "machine"]);
const PURPOSES: ReadonlySet<unknown> = new Set(["init", "work", "import", "check", "bench"]);

function member(body: object, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(body, key);
  return d !== undefined && "value" in d ? d.value : undefined;
}

/**
 * The first row of the table of TR-B02 that matches. Row 2 counts every named `pipeline`: `std` holds no pipeline
 * type in S0, so no pipeline can be shown free of `decide` and `calls-llm` (REQ-TR-001).
 */
export function basis(session: unknown, acted: boolean): Basis {
  if (typeof session !== "object" || session === null || Array.isArray(session)) return "inferred";
  const kind = member(session, "kind");
  const purpose = member(session, "purpose");
  if (!KINDS.has(kind) || !PURPOSES.has(purpose)) return "inferred";
  if (!acted) return "inferred"; // row 1
  if (kind === "machine" && Object.hasOwn(session, "pipeline")) return "inferred"; // row 2
  if (kind === "human" || kind === "agent") return "asserted"; // row 3
  if (purpose === "check" || purpose === "bench") return "observed"; // row 4
  return "derived"; // row 5: machine, init / work / import
}
