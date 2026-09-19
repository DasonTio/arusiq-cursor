/**
 * Severity — the product's core alerting mechanic.
 *
 * D5 UR-MNT-01 requires every alert to carry colour, icon AND label. Colour
 * never travels alone, so `SEVERITY` pairs each level with a shape and an i18n
 * key rather than exposing a bare colour.
 *
 * @requirement FR-20
 */

export const SEVERITY = {
  critical: { rank: 3, shape: 'square', labelKey: 'severity.critical' },
  warning: { rank: 2, shape: 'triangle', labelKey: 'severity.warning' },
  unknown: { rank: 1, shape: 'dashedRing', labelKey: 'severity.unknown' },
  normal: { rank: 0, shape: 'circle', labelKey: 'severity.normal' },
} as const;

export type Severity = keyof typeof SEVERITY;
export type SeverityShape = (typeof SEVERITY)[Severity]['shape'];

/**
 * D7 §4.2 — every level of the hierarchy shows the worst status of its
 * children. Precedence is critical > warning > unknown > normal.
 *
 * `unknown` outranks `normal` deliberately: an unreported unit may be the
 * broken one, so a grey child is never counted as green in a parent. Painting
 * a silent sensor green would be a lie the whole product is judged on.
 */
export const rollUp = (children: readonly Severity[]): Severity =>
  children.reduce<Severity>(
    (worst, s) => (SEVERITY[s].rank > SEVERITY[worst].rank ? s : worst),
    'normal',
  );

/**
 * D7 §4.2 — a roll-up is inspectable rather than a bare colour, so the
 * contributing count travels with it: "2 of 14 need attention".
 */
export const countAtOrAbove = (
  children: readonly Severity[],
  level: Severity,
): number => children.filter((s) => SEVERITY[s].rank >= SEVERITY[level].rank).length;

/** The shape every level of the hierarchy carries (D7 §4.2). */
export interface RollUp {
  severity: Severity;
  contributing: number;
  total: number;
}

/**
 * The whole roll-up in one call, so no caller pairs `rollUp()` with a
 * different contributing threshold than its neighbour did.
 *
 * `contributing` counts children at or above `unknown` — everything that is
 * not plainly healthy. Grey is inside the count for the same reason it
 * outranks green: an unreported child may be the broken one.
 */
export const rollUpWithCount = (children: readonly Severity[]): RollUp => ({
  severity: rollUp(children),
  contributing: countAtOrAbove(children, 'unknown'),
  total: children.length,
});

/**
 * Sort comparator, worst first, for `Array.prototype.sort`. Attention queues
 * order by severity precedence and nothing else decides it locally.
 */
export const compareSeverity = (a: Severity, b: Severity): number =>
  SEVERITY[b].rank - SEVERITY[a].rank;
