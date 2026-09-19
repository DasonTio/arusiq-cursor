/**
 * Freshness — the boundary between "this is the value" and "we do not know".
 *
 * D5 UR-SYS-02 / D7 §11.2 — a reading past the freshness window is not a
 * slightly old reading, it is an unknown. The comparison lives here so that no
 * component decides for itself how old is too old: a screen picking its own
 * window is how a silent sensor ends up painted green on one page and grey on
 * the next.
 *
 * THE WINDOW IS A PARAMETER, NOT A CONSTANT IN THIS FILE. The documents state
 * the rule ("show grey values with last-seen time when data is stale") without
 * fixing a number, and the number properly belongs to the reporting cadence of
 * whatever is producing the data — three missed reports, not fifteen minutes in
 * the abstract. Phase 1A passes `SIMULATED_POLICY.freshnessWindowMinutes`,
 * which is labelled as a simulated input; Phase 1B passes the real cadence.
 *
 * @requirement FR-15
 */
import type { Severity } from './severity.ts';

/** A reading with no last-seen time has never reported, which is also stale.
 *  The edge is inclusive: exactly at the window is still fresh. */
export const isStale = (
  lastSeen: string | null,
  now: Date | number,
  windowMs: number,
): boolean => {
  if (lastSeen === null) return true;
  const seen = Date.parse(lastSeen);
  if (Number.isNaN(seen)) return true;
  const at = typeof now === 'number' ? now : now.getTime();
  return at - seen > windowMs;
};

/**
 * D7 §4.1 / INV-GREY — a value we do not have is `unknown`, never `normal`.
 * Callers pass the severity the value would carry if it were fresh.
 */
export const freshnessSeverity = (
  lastSeen: string | null,
  now: Date | number,
  windowMs: number,
  ifFresh: Severity,
): Severity => (isStale(lastSeen, now, windowMs) ? 'unknown' : ifFresh);
