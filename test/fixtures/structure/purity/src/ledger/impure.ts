export const a = Date.now(); // expect: nondeterminism
export const b = process.env.X; // expect: forbidden-global
console.log(1); // expect: forbidden-global
export const c = import("./x.ts"); // expect: dynamic-import
