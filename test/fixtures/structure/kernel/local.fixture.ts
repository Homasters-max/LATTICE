const process = 1;
const x = { process: 2 };
export const v = process + x.process;

interface X {
  console: number;
}
export class A {
  process(): number {
    return 1;
  }
}
export let f: Function | undefined;
export const y: X = { console: 1 };
