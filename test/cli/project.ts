// A temporary project for the CLI tests (design D-10): `run` in process on a fresh folder, with the deterministic
// clock and ids of ST-T02, so every byte the commands write is known.

import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../../src/cli/run.ts";
import type { Ports } from "../../src/assembly/index.ts";
import { fixedClock } from "../../src/adapters/clock-fixed/index.ts";
import { counterIds } from "../../src/adapters/ids-counter/index.ts";

export const repo = fileURLToPath(new URL("../../", import.meta.url));
export const FIXTURE = join(repo, "test", "fixtures", "md", "fixture.md");

export type Result = { readonly code: number; readonly out: readonly string[]; readonly err: readonly string[] };

export type Project = {
  readonly dir: string;
  lattice(...argv: string[]): Result;
  file(path: string): string;
  write(path: string, text: string): void;
  exists(path: string): boolean;
  proposals(): string[];
  dispose(): void;
};

export function project(ports: Ports = {}): Project {
  const dir = mkdtempSync(join(tmpdir(), "lattice-"));
  const all: Ports = { clock: fixedClock(0), ids: counterIds(), ...ports };
  return {
    dir,
    lattice(...argv) {
      const out: string[] = [];
      const err: string[] = [];
      const code = run(argv, { cwd: dir, out: (l) => out.push(l), err: (l) => err.push(l), ports: all });
      return { code, out, err };
    },
    file: (path) => readFileSync(join(dir, path), "utf8"),
    write: (path, text) => writeFileSync(join(dir, path), text),
    exists: (path) => existsSync(join(dir, path)),
    proposals: () => (existsSync(join(dir, "store/proposals")) ? readdirSync(join(dir, "store/proposals")).sort() : []),
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A project after `init`, with the fixture copied in as `fixture.md`. */
export function initialised(ports: Ports = {}): Project {
  const p = project(ports);
  copyFileSync(FIXTURE, join(p.dir, "fixture.md"));
  const r = p.lattice("init", "--namespace", "lattice", "--owner", "Homasters-max");
  if (r.code !== 0) throw new Error(`init: ${r.err.join("; ")}`);
  return p;
}

/** The path of the only proposal, relative to the project root. */
export function onlyProposal(p: Project): string {
  const files = p.proposals();
  if (files.length !== 1) throw new Error(`expected one proposal, found ${files.length}`);
  return `store/proposals/${files[0]}`;
}
