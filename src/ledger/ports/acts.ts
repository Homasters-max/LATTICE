// The `acts` port (LG-A04, CT-A05, design D-2): acts reach apply only through it. An act comes from a login and names
// a proposal hash or intent ids; `ref` is the URL of the comment or review it was read from (LG-A05). The skeleton has
// no adapter and no caller of it; s0-bootstrap (#59) adds the adapters `init`, `fixture`, `recorded`, `github`.

export type Act = { readonly login: string; readonly names: readonly string[]; readonly ref: string };

export interface Acts {
  /** The acts naming the proposal hash `proposal` or the ids of its intents. */
  actsOn(proposal: string): readonly Act[];
}
