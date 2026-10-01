// The `store` port (LG-S02, design D-2): the ledger as the canonical JSON texts of its commits in order. Physical
// offsets stay inside an adapter (LG-S01); a tail without a commit end marker is handed over as `torn`, never as a
// commit (LG-C06).

/** One commit as stored: its `seq` as the adapter read it (`NaN` when unreadable) and its text without the line feed. */
export type StoredCommit = { readonly seq: number; readonly text: string };

export type StoredLedger = { readonly commits: readonly StoredCommit[]; readonly torn: string | null };

export type AppendResult = { readonly ok: true } | { readonly ok: false; readonly reason: "moved" };

export interface Store {
  read(): StoredLedger;
  /** Appends `commit` right after the commit `after` (`0` on an empty ledger); `moved` when the tail is elsewhere (LG-C03). */
  append(commit: StoredCommit, after: number): AppendResult;
}
