// `lattice <command> [arguments]` (REQ-CL-001, design D-8): looks the command up in the table, or prints the usage.

import type { Io } from "./io.ts";
import { COMMANDS } from "./table.ts";

function usage(io: Io): number {
  io.err("usage: lattice <command> [arguments]");
  io.err("commands:");
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  for (const c of COMMANDS) io.err(`  ${c.name.padEnd(width)}  ${c.summary}`);
  return 2;
}

export function run(argv: readonly string[], io: Io): number {
  const [name, ...args] = argv;
  const command = COMMANDS.find((c) => c.name === name);
  return command === undefined ? usage(io) : command.run(args, io);
}
