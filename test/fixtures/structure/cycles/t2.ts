import type { T1 } from "./t1.ts"; // expect: import-cycle

export type T2 = { readonly t1: T1 };
