/// <reference path="../outside/x.ts" /> // expect: import-outside-kernel
/// <reference no-default-lib="true" /> // expect: import-outside-kernel
export const m = import("../outside/x.ts"); // expect: dynamic-import
export const r = require("../outside/x.ts"); // expect: dynamic-import
export const v = 1;
