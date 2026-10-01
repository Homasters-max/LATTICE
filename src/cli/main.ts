#!/usr/bin/env -S node --experimental-strip-types
// The `lattice` entry (PL-E02, design D-8): the process around `run`.

import { run } from "./run.ts";

process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
});
