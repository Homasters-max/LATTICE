// Genesis (LG-G01, OM-L01, REQ-LG-006, design D-2): the constant first proposal of kernel version `0` — the meta-type,
// the session event type and the genesis session that records itself. Applied without acts on an empty ledger it gives
// the genesis commit, whose hash `GENESIS_HASH` is a literal the tests pin: this file never calls apply.

import type { Hash, Id } from "../kernel/index.ts";
import { metaType } from "../kernel/index.ts";
import type { EntityIntent, EventIntent, Proposal } from "./proposal.ts";
import { proposalHash, SESSION_TYPE } from "./proposal.ts";
import { frozen } from "./records.ts";

/** The body of the session event type `core/session` (CT-P01; the purposes of TR-B02). */
export const SESSION_TYPE_BODY = frozen({
  schema: {
    type: "object",
    properties: {
      established: { type: "string", maxLength: 128 },
      kind: { type: "string", enum: ["agent", "human", "machine"] },
      of: { type: "object", properties: {} },
      participant: { type: "string", maxLength: 128 },
      pipeline: { type: "string", ref: "std/pipeline", pinned: true },
      purpose: { type: "string", enum: ["bench", "check", "import", "init", "work"] },
      software: { type: "string", maxLength: 128 },
      version: { type: "string", maxLength: 128 },
    },
    required: ["kind", "of", "participant", "purpose"],
  },
});

/** The body of every session of store init and of genesis: `machine`, purpose `init` (LG-G01, LG-G02, TR-B02). */
export const INIT_SESSION_BODY = frozen({ of: {}, participant: "lattice", kind: "machine", purpose: "init" });

export const TYPE_TYPE = "core/type@1";
const SESSION = "core/00000000000000000000000000" as Id;
const AT = "1970-01-01T00:00:00.000Z";

const typeIntent = (id: string, body: unknown): EntityIntent => ({ kind: "entity", id: id as Id, type: TYPE_TYPE, base: 0, by: SESSION, body });
const session: EventIntent = { kind: "event", id: SESSION, type: SESSION_TYPE, by: SESSION, at: AT, body: INIT_SESSION_BODY };

/** The genesis proposal of kernel version `0`. */
export const GENESIS: Proposal = frozen({
  intents: [typeIntent("core/session", SESSION_TYPE_BODY), typeIntent("core/type", metaType.body), session],
  session,
});

/** The proposal hash of the genesis proposal: the exemption `CT-N02` by `LG-G01` (REQ-LG-002). */
export const GENESIS_PROPOSAL: Hash = proposalHash(GENESIS);

/** The commit hash of the genesis commit of kernel version `0` (SCN-LG-009 pins it). */
export const GENESIS_HASH = "fbbed761c8fdca026cf0690aace65de7728edfb0a1c24082f23083077bc4099b" as Hash;
