/// <reference path="../outside/x.ts" /> // expect: import-outside-kernel
/// <reference no-default-lib="true" /> // expect: import-outside-kernel
import { y } from "./y.ts/"; // expect: import-outside-kernel
import { z } from ".//z.ts";
export const m = import("../outside/x.ts"); // expect: dynamic-import
export const r = require("../outside/x.ts"); // expect: dynamic-import
export const v = [y, z];
