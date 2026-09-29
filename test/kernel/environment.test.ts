// Precondition of format v1 (UNK-KR-006): the runtime NFC is at least Unicode 16.0; the kernel table of assigned
// code points equals the complement of \p{Cn} on a Unicode 16.0 runtime (UNK-KR-005, design D-7).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assignedRanges, isAssigned16 } from "../../src/kernel/unicode16.ts";

const unicode = process.versions.unicode ?? "0.0";

describe("SCN-KR-025 runtime Unicode", () => {
  it("SCN-KR-025 Unicode of the runtime is at least 16.0", () => {
    const [major = 0, minor = 0] = unicode.split(".").map(Number);
    assert.ok(major > 16 || (major === 16 && minor >= 0), `runtime Unicode ${unicode} is below 16.0`);
  });
});

describe("SCN-KR-023 Unicode 16.0 table", () => {
  it("SCN-KR-023 ranges are sorted and disjoint", () => {
    for (let i = 0; i < assignedRanges.length; i += 2) {
      const start = assignedRanges[i] as number;
      const end = assignedRanges[i + 1] as number;
      assert.ok(start <= end, `range ${i / 2}`);
      if (i > 0) assert.ok(start > (assignedRanges[i - 1] as number) + 1, `range ${i / 2} touches the previous one`);
    }
  });

  // No SCN token in the name: the scenario is proven by the cases of scenarios.test.ts; this cross-check runs only on
  // a Unicode 16.0 runtime, and WARRANT 0.8.2 turns a skipped test with an SCN id into NOT_PROVEN (06 §2, I-6).
  it(
    "table equals the complement of \\p{Cn} of Unicode 16.0 (runtime 16.0 only)",
    { skip: unicode === "16.0" ? false : `runtime Unicode ${unicode} is not 16.0` },
    () => {
      const cn = /\p{Cn}/u;
      for (let c = 0; c <= 0x10ffff; c++) {
        const expected = !cn.test(String.fromCodePoint(c));
        if (isAssigned16(c) !== expected) assert.fail(`U+${c.toString(16)}: table ${!expected}, runtime ${expected}`);
      }
    },
  );
});
