// `service` adapter of the `clock` port (PL-K01): the system clock, integer UTC milliseconds.

import type { Clock } from "../../runtime/ports/clock.ts";

export function systemClock(): Clock {
  return { now: () => Date.now() };
}
