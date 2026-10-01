// The `ids` port (OM-I02, PL-K01, design D-2): a new ULID, 26 characters of Crockford Base32. Adapters: `ids-ulid`,
// `ids-counter` (ST-T02).

export interface Ids {
  ulid(): string;
}
