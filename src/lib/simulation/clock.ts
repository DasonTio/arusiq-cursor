/**
 * Time, injected rather than read.
 *
 * Every timestamp the simulator emits is an OFFSET from a single `now`. Pass
 * the fixed reference and the dataset is byte-identical on every run, which is
 * what makes it testable; pass `() => new Date()` and the same dataset reads as
 * live to a stakeholder, because "3 minutes ago" is still 3 minutes ago
 * tomorrow. Nothing here calls `Math.random` or a bare `new Date()`.
 *
 * @requirement FR-15
 */

/** 09:00 Asia/Jakarta on the Friday of the prototype demo. */
export const REFERENCE_NOW = '2026-09-18T02:00:00.000Z';

/** Asia/Jakarta (WIB) is a fixed +07:00 with no daylight saving, so day and
 *  month boundaries are arithmetic rather than a timezone database. */
export const JAKARTA_OFFSET_MINUTES = 420;

export type Clock = () => Date;

export const fixedClock =
  (iso: string = REFERENCE_NOW): Clock =>
  () =>
    new Date(iso);

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const shift = (now: Date, ms: number): string =>
  new Date(now.getTime() + ms).toISOString();

export const minutesBefore = (now: Date, n: number): string =>
  shift(now, -n * MINUTE_MS);
export const minutesAfter = (now: Date, n: number): string => shift(now, n * MINUTE_MS);
export const hoursBefore = (now: Date, n: number): string => shift(now, -n * HOUR_MS);
export const hoursAfter = (now: Date, n: number): string => shift(now, n * HOUR_MS);
export const daysBefore = (now: Date, n: number): string => shift(now, -n * DAY_MS);
export const daysAfter = (now: Date, n: number): string => shift(now, n * DAY_MS);

const offsetMs = JAKARTA_OFFSET_MINUTES * MINUTE_MS;

/** Midnight in Jakarta, expressed as the UTC instant it happened. */
export const startOfLocalDay = (now: Date): Date => {
  const local = now.getTime() + offsetMs;
  return new Date(local - (local % DAY_MS) - offsetMs);
};

/** The first instant of the local calendar month containing `now`. */
export const startOfLocalMonth = (now: Date): Date => {
  const local = new Date(now.getTime() + offsetMs);
  const firstLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return new Date(firstLocal - offsetMs);
};

/** Whole local days elapsed since the start of the month, `now` included. */
export const localDayOfMonth = (now: Date): number =>
  Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalMonth(now).getTime()) / DAY_MS,
  ) + 1;

/** The local calendar day of an instant, as `YYYY-MM-DD`. Used as a series
 *  key; the value on the wire stays a full ISO instant so the locale can
 *  format it (D7 §6.5). */
export const localDayKey = (instant: Date | string): string => {
  const at = typeof instant === 'string' ? new Date(instant) : instant;
  return new Date(at.getTime() + offsetMs).toISOString().slice(0, 10);
};
