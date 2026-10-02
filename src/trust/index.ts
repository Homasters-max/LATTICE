// Module `trust` (design-next ST-M01): namespace policy and trust rules as pure functions over records — basis,
// writers and owner acts, in force, findings. S0 (s0-bootstrap #59): the basis table, the current value of a fact and
// the `live` revision, the namespace policy.

export type { Basis } from "./basis.ts";
export { basis } from "./basis.ts";
export { currentFacts, LIVE_TYPE, liveRevision } from "./facts.ts";
export type { Policy, PolicyOf, Writer } from "./namespace.ts";
export { actLogins, policyOf } from "./namespace.ts";
