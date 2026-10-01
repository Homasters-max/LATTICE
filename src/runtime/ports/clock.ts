// The `clock` port (PL-K01, design D-2): integer UTC milliseconds. Adapters: `clock-system`, `clock-fixed` (ST-T02).

export interface Clock {
  now(): number;
}
