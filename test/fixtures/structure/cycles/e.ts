import { c } from "./c.ts"; // expect: import-cycle

export const e = () => c;
