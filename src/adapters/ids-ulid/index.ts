// `service` adapter of the `ids` port (OM-I02): a ULID — 48 bits of time from the system clock and 80 random bits,
// in Crockford Base32, 26 characters.

import { randomBytes } from "node:crypto";
import type { Ids } from "../../runtime/ports/ids.ts";

const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encode(value: bigint, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out = BASE32[Number(value % 32n)] + out;
    value /= 32n;
  }
  return out;
}

export function ulidIds(): Ids {
  return {
    ulid: () => encode(BigInt(Date.now()), 10) + encode(BigInt("0x" + randomBytes(10).toString("hex")), 16),
  };
}
