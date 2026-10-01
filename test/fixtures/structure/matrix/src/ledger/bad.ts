import { c } from "../codec/good.ts"; // expect: import-direction
import { t } from "../../test/x.ts"; // expect: import-direction
import pkg from "lodash"; // expect: package-import
export const v = [c, t, pkg];
