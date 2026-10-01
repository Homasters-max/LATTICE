// Deterministic adapter of the `clock` port for tests (ST-T02): always the same integer UTC milliseconds.

import type { Clock } from "../../runtime/ports/clock.ts";

export function fixedClock(ms: number): Clock {
  return { now: () => ms };
}
