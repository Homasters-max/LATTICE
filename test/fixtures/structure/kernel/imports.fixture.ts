import { readFileSync } from "node:fs"; // expect: import-outside-kernel
import { commit } from "../ledger/commit.ts"; // expect: import-outside-kernel
import canonicalize from "canonicalize"; // expect: import-outside-kernel
import { createHash } from "crypto"; // expect: import-outside-kernel
export { x } from "node:path"; // expect: import-outside-kernel
import type { T } from "../run/types.ts"; // expect: import-outside-kernel
import { h } from "./helper.js"; // expect: import-outside-kernel
import fs = require("node:fs"); // expect: import-outside-kernel
export let t: import("../ledger/types.ts").T | undefined; // expect: import-outside-kernel
export const used = [readFileSync, commit, canonicalize, createHash, h, fs];
export type { T };
