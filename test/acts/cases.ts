// The case of the acts contract (REQ-AC-001): hashes H, K, J, the owner, and the recorded answers of a pull request.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Transport } from "../../src/adapters/acts-github/index.ts";

export const H = "3f".repeat(32);
export const K = "a1".repeat(32);
export const J = "0c".repeat(32);
export const OWNER = "Homasters-max";
export const REPO = "Homasters-max/LATTICE";

type Pr = { comments: unknown[]; reviews: unknown[] };

/** The recorded answers of pull request 7, with `<H>` written as the hash H. */
export function pr7(): Pr {
  const text = readFileSync(fileURLToPath(new URL("../fixtures/acts/github/pr7.json", import.meta.url)), "utf8");
  return JSON.parse(text.replaceAll("<H>", H)) as Pr;
}

/** A transport answering `pages` per path prefix, page by page; it records the paths asked. */
export function recorded(pages: { comments: unknown[][]; reviews: unknown[][] }, asked: string[] = []): Transport {
  return (path) => {
    asked.push(path);
    const page = Number(/[?&]page=(\d+)/.exec(path)?.[1] ?? "0");
    const list = path.includes("/issues/") ? pages.comments : pages.reviews;
    return list[page - 1] ?? [];
  };
}

/** One page each of the recorded answers of pull request 7. */
export const pr7Transport = (asked: string[] = []): Transport => {
  const pr = pr7();
  return recorded({ comments: [pr.comments], reviews: [pr.reviews] }, asked);
};
