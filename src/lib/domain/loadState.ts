/**
 * Four data states that are NOT interchangeable (D7 §18.3, D5 UR-SYS-04).
 *
 * Confusing `noData` with `empty` is how a dashboard comes to imply that a unit
 * consumed 0 kWh when it was simply offline.
 *
 * @requirement FR-15
 */

export const LOAD_STATE = ['loading', 'empty', 'error', 'noData', 'ready'] as const;
export type LoadState = (typeof LOAD_STATE)[number];

/**
 * D7 §11.2 — missing is not zero. A value that has not reported renders grey
 * with a last-seen time; it never falls back to a plausible number.
 */
export interface StaleMarker {
  state: 'noData';
  lastSeen: string | null;
}
