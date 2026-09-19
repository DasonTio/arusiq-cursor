/**
 * Comfort verdict — "is this room comfortable?" answered from readings.
 *
 * D2 C-1 and C-2 both require a per-room comfort verdict in plain language
 * (D5 UR-AIR-01: "shows them with plain-language bands"). The classification is
 * a comparison between two numbers, so by `context/40-architecture.md` it lives
 * here and not in a room row.
 *
 * THE ENVELOPE IS NOT IN THIS FILE, AND THAT IS DELIBERATE. D5 and D6 require
 * bands without fixing their edges, and FR-27 makes thresholds an Admin setting
 * — so the edges are an *input*, not domain truth. The caller supplies them:
 * Phase 1A from `SIMULATED_POLICY.comfortEnvelope` (labelled simulated), Phase
 * 1B from the settings table. A default living here would quietly become the
 * number everyone quotes.
 *
 * @requirement FR-63
 */
import type { Severity } from './severity.ts';

/** Inclusive on both edges: `min` and `max` are comfortable, not the first
 *  values outside. */
export interface ComfortBand {
  min: number;
  max: number;
}

export interface ComfortEnvelope {
  temperatureC: ComfortBand;
  humidityPct: ComfortBand;
}

export const COMFORT_VERDICT = [
  'comfortable',
  'tooWarm',
  'tooCool',
  'tooHumid',
  'tooDry',
  'unknown',
] as const;

export type ComfortVerdict = (typeof COMFORT_VERDICT)[number];

export interface ComfortInput {
  temperatureC: number | null;
  humidityPct: number | null;
}

/**
 * A missing input yields `unknown`, never `comfortable`. Declaring a room
 * comfortable on partial evidence is the same lie as painting an offline unit
 * green (INV-NO-FABRICATION), so temperature alone is never enough.
 *
 * Temperature is judged before humidity because it is what the occupant feels
 * first — which also means a room whose humidity sensor is absent still reports
 * `tooWarm` when it is too warm, rather than hiding a real problem behind a
 * missing channel.
 */
export const comfortVerdict = (
  { temperatureC, humidityPct }: ComfortInput,
  envelope: ComfortEnvelope,
): ComfortVerdict => {
  if (temperatureC === null) return 'unknown';
  if (temperatureC > envelope.temperatureC.max) return 'tooWarm';
  if (temperatureC < envelope.temperatureC.min) return 'tooCool';
  if (humidityPct === null) return 'unknown';
  if (humidityPct > envelope.humidityPct.max) return 'tooHumid';
  if (humidityPct < envelope.humidityPct.min) return 'tooDry';
  return 'comfortable';
};

/**
 * Comfort never reaches `critical`: a warm afternoon is not a failing
 * compressor, and the two must not share a rung. Callers keep comfort severity
 * separate from the equipment roll-up rather than merging them.
 */
export const comfortSeverity = (verdict: ComfortVerdict): Severity => {
  if (verdict === 'comfortable') return 'normal';
  if (verdict === 'unknown') return 'unknown';
  return 'warning';
};

export const comfortLabelKey = (verdict: ComfortVerdict): string =>
  `comfort.${verdict}`;
