import { createHash as h } from "node:crypto";
import { k } from "./hash.ts";

const s = "a";
const o = { a: 1 };
const n = 1;
export const out = [
  h("sha256").update(s).digest("hex"),
  new Date(0).toISOString(),
  new Date(n).getTime(),
  Math.floor(1.5),
  JSON.stringify(s),
  Reflect.ownKeys(o),
  Number.isSafeInteger(n),
  new Map(),
  k,
];
