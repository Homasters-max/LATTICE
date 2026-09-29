import y = require("./r1.ts"); // expect: import-cycle

export const r2 = () => y;
