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
