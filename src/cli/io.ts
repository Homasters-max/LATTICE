// What a command gets and gives (REQ-CL-001, design D-8): the project root, the output streams, ports injected by
// tests, and the exit code — 0 done, 1 rejected or refused input, 2 usage error or refusal.

import type { Outcome, Ports } from "../assembly/index.ts";

export type Io = {
  readonly cwd: string;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly ports?: Ports;
};

export type Command = {
  readonly name: string;
  readonly summary: string;
  readonly run: (args: readonly string[], io: Io) => number;
};

/** A usage error of a command: the message and code 2. */
export function usageError(io: Io, command: string, message: string): number {
  io.err(`lattice ${command}: ${message}`);
  return 2;
}

/** The outcome of an operation on the streams, and its exit code. */
export function report(io: Io, outcome: Outcome): number {
  switch (outcome.kind) {
    case "done":
      for (const line of outcome.output) io.out(line);
      return 0;
    case "rejected":
      io.out(JSON.stringify(outcome.rejections));
      return 1;
    case "refused-input":
      io.err(outcome.message);
      return 1;
    case "refused":
      io.err(outcome.message);
      return 2;
  }
}
