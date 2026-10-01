import type { Store } from "../../ledger/ports/store.ts";
import { other } from "./other.ts";
import { readFileSync } from "node:fs";
import vendor from "vendor-sdk";
import { y } from "../clock-y/index.ts"; // expect: import-direction
import { l } from "../../ledger/index.ts"; // expect: import-direction
export const s: Store | null = null;
export const v = [other, readFileSync, vendor, y, l];
