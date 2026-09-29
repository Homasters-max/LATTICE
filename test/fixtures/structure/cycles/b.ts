import { a } from "./a.ts"; // expect: import-cycle

export const b = () => a;
