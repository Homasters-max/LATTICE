import { randomUUID } from "node:crypto"; // expect: crypto-import
import "node:crypto"; // expect: crypto-import
export { createHash } from "node:crypto"; // expect: crypto-import
export const id = randomUUID;
