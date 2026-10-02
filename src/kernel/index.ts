// The kernel interface (REQ-KR-008, OM-L04): parse, canonical form, references, admission against a type, the
// meta-type, the envelope — and, until #83, the transitional `hash` and `newId` of REQ-KR-018.

export type { Admitted, BodyRef, EntityRecord, EventRecord, Hash, Id, Ref, Refusal, Result, Type } from "./types.ts";
export { checkInput } from "./input.ts";
export { canonical } from "./canonical.ts";
export { formatRef, parseRef } from "./ref.ts";
export { admit, metaType, typeOf } from "./admission.ts";
export { entity, event, formatAt } from "./envelope.ts";
// Transitional (REQ-KR-018): removed by #83.
export { hash, newId } from "./transitional.ts";
