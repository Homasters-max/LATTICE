import { describe, suite, test, it } from "node:test";
import { test as t2 } from "node:test";
import * as nt from "node:test";

test("top", () => {}); // expect: test-outside-describe
test.skip("top skip", () => {}); // expect: test-outside-describe
t2("renamed", () => {}); // expect: test-outside-describe
nt.it("namespace", () => {}); // expect: test-outside-describe
function plain(): void {
  it("in a plain function", () => {}); // expect: test-outside-describe
}
describe("d", () => {
  test("inside describe", () => {});
});
suite("s", () => {
  it("inside suite", () => {});
});
describe.skip("ds", () => {
  test("inside describe.skip", (t) => {
    t.test("subtest", () => {});
  });
});
function body(): void {
  test("in a function passed by reference", () => {}); // expect: test-outside-describe
}
describe("x", body);
function shadow(test: (name: string) => void): void {
  test("shadowed");
}
export { plain, shadow };
