declare const process: { env: Record<string, string> };
export const home = process.env.HOME; // expect: forbidden-global
