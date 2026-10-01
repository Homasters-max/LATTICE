import { s } from "../adapters/store-x/index.ts";
import { l } from "../ledger/good.ts";
import { c } from "../codec/good.ts";
import { readFileSync } from "node:fs";
export const a = [s, l, c, readFileSync];
