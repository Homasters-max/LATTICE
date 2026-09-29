export const x = 1;
export let t: import("./u1.ts").T | undefined; // expect: import-cycle
