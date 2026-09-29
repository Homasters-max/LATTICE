import { x } from "./A.ts";
type T = import("../outside/t.ts").T; // expect: import-outside-kernel outside-perimeter
interface I {
  s: import("node:fs").Stats; // expect: import-outside-kernel
}
declare const d: import("node:fs").Stats; // expect: import-outside-kernel

export type U = T | I;
export const v = x;
