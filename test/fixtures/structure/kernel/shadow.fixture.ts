export function f(console: number): number {
  return console;
}
export function g(): unknown {
  return console; // expect: forbidden-global
}
