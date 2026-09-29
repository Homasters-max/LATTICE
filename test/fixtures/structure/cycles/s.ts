import { s } from "./s.ts"; // expect: import-cycle

export const t = () => s;
