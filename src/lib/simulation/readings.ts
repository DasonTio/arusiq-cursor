/**
 * Reading constructors. Every figure is stamped simulated at the source
 * (ADR-0004). A missing value is `null`, never zero.
 *
 * @requirement FR-15
 */
import type { MaybeReading, Reading } from './types.ts';

export const SIMULATED = 'simulated' as const;

export const simReading = (value: number, lastSeen: string): Reading => ({
  value,
  provenance: SIMULATED,
  lastSeen,
});

/** Fitted, but quiet. The last real instant travels with the null. */
export const staleReading = (lastSeen: string): Reading => ({
  value: null,
  provenance: SIMULATED,
  lastSeen,
});

export const absentSensor = (sensorKey: string): MaybeReading => ({
  kind: 'absent',
  sensorKey,
});

export const isAbsent = (
  reading: MaybeReading,
): reading is Extract<MaybeReading, { kind: 'absent' }> =>
  'kind' in reading && reading.kind === 'absent';

export const asReading = (reading: MaybeReading): Reading | null =>
  isAbsent(reading) ? null : reading;
