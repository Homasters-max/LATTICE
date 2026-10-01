// JSONL adapter of the `store` port (LG-S02, design D-9): one commit per line, each line ended by a line feed — the
// commit end marker; a last line without one is the torn tail (LG-C06). Minimal in the walking skeleton: no lock,
// fencing, fsync or recovery — s0-store (#57) adds them. A file that is not valid UTF-8 is not read at all: `read`
// throws, and the caller refuses the ledger.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { AppendResult, Store, StoredCommit, StoredLedger } from "../../ledger/ports/store.ts";

function seqOf(text: string): number {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && "seq" in value && typeof value.seq === "number") return value.seq;
  } catch {
    // an unreadable line: the ledger refuses it when it opens (LG-C04)
  }
  return Number.NaN;
}

export function jsonlStore(file: string): Store {
  const read = (): StoredLedger => {
    const text = existsSync(file) ? new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file)) : "";
    if (text === "") return { commits: [], torn: null };
    const lines = text.split("\n");
    const last = lines.pop() as string; // "" when the file ends with a line feed
    const commits: StoredCommit[] = lines.map((line) => ({ seq: seqOf(line), text: line }));
    return { commits, torn: last === "" ? null : last };
  };
  return {
    read,
    append(commit: StoredCommit, after: number): AppendResult {
      const { commits, torn } = read();
      const tail = commits.length === 0 ? 0 : (commits[commits.length - 1] as StoredCommit).seq;
      if (torn !== null || tail !== after) return { ok: false, reason: "moved" };
      appendFileSync(file, commit.text + "\n");
      return { ok: true };
    },
  };
}
