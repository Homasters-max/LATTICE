// Rejections of apply (LG-A02, REQ-AR-011, design D-5): the closed list of rule IDs apply can name and the only way to
// build a rejection, so a rule outside the list does not type-check. Every rule ID has a fixture in
// test/fixtures/rules/<RULE-ID>/.

export const REJECTION_RULES = ["LG-C07", "LG-P01", "LG-P02"] as const;

export type RuleId = (typeof REJECTION_RULES)[number];

export type Rejection = {
  readonly intent: string | null;
  readonly rule: RuleId;
  readonly message: string;
  readonly path: string;
  readonly expected: unknown;
  readonly got: unknown;
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

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The order of REQ-CL-004: `intent` (`null` first), `rule`, `path`, then the order they were found in. */
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
