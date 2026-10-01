// Deterministic adapter of the `ids` port for tests (ST-T02): ULIDs `0…01`, `0…02`, … — a counter in Crockford
// Base32 over 26 characters, so each is a valid ULID with time 0.

import type { Ids } from "../../runtime/ports/ids.ts";

const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function counterIds(start = 1): Ids {
  let next = start;
  return {
    ulid: () => {
      let value = next++;
      let out = "";
      for (let i = 0; i < 26; i++) {
        out = BASE32[value % 32] + out;
        value = Math.floor(value / 32);
      }
      return out;
    },
  };
}
