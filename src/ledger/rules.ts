// Rejections of apply (LG-A02, REQ-LG-002, REQ-AR-011, design D-2): the closed list of rule IDs apply can name and the
// only ways to build a rejection, so a rule outside the list does not type-check. Every rule ID has a fixture in
// test/fixtures/rules/<RULE-ID>/.

import { byCodeUnits } from "./records.ts";

export const REJECTION_RULES = ["CT-N02", "LG-C03", "LG-C07", "LG-P01", "LG-P02"] as const;

export type RuleId = (typeof REJECTION_RULES)[number];

/**
 * The exemptions of apply (LG-A07, REQ-LG-002): each names the rule it lifts and the rule that grants it, decided from
 * the proposal and the ledger as a whole, never from an `id` alone.
 */
export const EXEMPTIONS: readonly { readonly rule: RuleId; readonly by: string }[] = Object.freeze([
  Object.freeze({ rule: "CT-N02", by: "LG-G01" }),
  Object.freeze({ rule: "CT-N02", by: "LG-G02" }),
]);

export type Rejection = {
  readonly intent: string | null;
  readonly rule: RuleId;
  readonly message: string;
  readonly path: string;
  readonly expected: unknown;
  readonly got: unknown;
  /** A duplicate only: the `id` the intent collided with. */
  readonly with?: string;
  /** A duplicate only: the paths where the colliding intents differ. */
  readonly differs?: readonly string[];
};

export function reject(
  rule: RuleId,
  intent: string | null,
  path: string,
  message: string,
  expected: unknown = null,
  got: unknown = null,
): Rejection {
  return Object.freeze({ intent, rule, message, path, expected, got });
}

/** A rejection for a duplicate (LG-A02): it also names the `id` it collided with and the differing paths. */
export function duplicate(
  rule: RuleId,
  intent: string,
  path: string,
  message: string,
  withId: string,
  differs: readonly string[],
): Rejection {
  return Object.freeze({ intent, rule, message, path, expected: null, got: null, with: withId, differs: Object.freeze([...differs]) });
}

/** The order of REQ-LG-002: `intent` (`null` first), `rule`, `path`, then the order they were found in. */
export function sortRejections(found: readonly Rejection[]): readonly Rejection[] {
  return [...found].sort((a, b) => {
    if (a.intent !== b.intent) {
      if (a.intent === null) return -1;
      if (b.intent === null) return 1;
      return byCodeUnits(a.intent, b.intent);
    }
    return byCodeUnits(a.rule, b.rule) || byCodeUnits(a.path, b.path);
  });
}
