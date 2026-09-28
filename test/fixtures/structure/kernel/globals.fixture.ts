export const m = import("./x.ts"); // expect: dynamic-import
export const home = process.env.HOME; // expect: forbidden-global
export const p = fetch("https://example.org"); // expect: forbidden-global
export const g = globalThis.x; // expect: forbidden-global
console.log(1); // expect: forbidden-global
export const f = new Function("return 1"); // expect: forbidden-global
export function later(cb: () => void): void {
  setTimeout(cb, 0); // expect: forbidden-global
}
export const o = { process }; // expect: forbidden-global
export const w = new WebSocket("wss://example.org"); // expect: forbidden-global
export const u = import.meta.url; // expect: forbidden-global
export const c = structuredClone({}); // expect: forbidden-global
export function args(): number {
  return arguments.length; // expect: forbidden-global
}
