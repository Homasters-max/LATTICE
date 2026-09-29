import { b } from "../outside/b.ts"; // expect: import-outside-kernel outside-perimeter
export { y } from "../outside/e.ts"; // expect: import-outside-kernel outside-perimeter

export const x = b;
