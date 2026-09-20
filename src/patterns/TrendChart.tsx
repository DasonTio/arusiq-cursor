/**
 * TrendChart — one measured series against the counterfactual it is compared
 * against, over a shared time axis.
 *
 * THIS EXISTS BECAUSE IT WAS WRITTEN THREE TIMES. `client.energy`,
 * `client.overview` and `shared.unit` each hand-rolled the same chart, and the
 * copies did not merely drift in styling — they duplicated two defects:
 *
 * 1. Each series was scaled across ITS OWN length, so a 27-day meter was
 *    stretched to the full width of a 30-day baseline and stacked on it. Any
 *    vertical comparison then read off two different days.
 * 2. The accessible summary totalled every point of both series, comparing a
 *    30-day normal with a 27-day meter and reporting the missing days as a
 *    saving.
 *
 * Both were fixed once, in one copy. So the invariants live HERE now:
 *
 * - One x axis, the sorted union of both series' timestamps.
 * - `accessibleName` is handed totals computed over the days BOTH series
 *   report. The caller cannot supply its own, which is what let the bug
 *   return the first time.
 * - A gap stays a gap. Line and fill are built from the same contiguous runs,
 *   so a silent day breaks both rather than being drawn through (D7 §11.2).
 * - The y axis is anchored at zero: the filled area is the quantity, and the
 *   dashed line above it is the normal.
 *
 * @requirement FR-61
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrendChartProps, TrendPoint } from '../components/contracts.ts';
import styles from './TrendChart.module.css';

/** Quarter gridlines, in the shared 100 × 30 viewBox. */
const GRID = [0.25, 0.5, 0.75].map((fraction) => 28 - fraction * 26);

/** Totals over the days BOTH series report — the only comparable pair. */
function comparableTotals(
  lead: readonly TrendPoint[],
  reference: readonly TrendPoint[],
): { lead: number; reference: number } {
  const reported = new Set(lead.map((point) => point.t));
  const sum = (points: readonly TrendPoint[]) =>
    points.reduce((total, point) => total + point.value, 0);
  return {
    lead: sum(lead),
    reference: sum(reference.filter((point) => reported.has(point.t))),
  };
}

export function TrendChart({
  lead,
  reference,
  accessibleName,
  leadLabelKey,
  referenceLabelKey,
}: TrendChartProps) {
  const { t } = useTranslation();
  /** Two charts can share a page, so the gradient needs its own id. */
  const areaId = `${useId()}-area`;

  const max = Math.max(
    ...lead.map((point) => point.value),
    ...reference.map((point) => point.value),
    1,
  );
  const domain = [...new Set([...reference, ...lead].map((point) => point.t))].sort();
  const xAt = (stamp: string) => {
    const index = domain.indexOf(stamp);
    return domain.length <= 1 ? 0 : (index / (domain.length - 1)) * 100;
  };

  const runsOf = (points: readonly TrendPoint[]) => {
    const byDay = new Map(points.map((point) => [point.t, point.value] as const));
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    domain.forEach((stamp) => {
      const value = byDay.get(stamp);
      if (value === undefined) {
        if (run.length > 0) runs.push(run);
        run = [];
        return;
      }
      run.push({ x: xAt(stamp), y: 28 - (value / max) * 26 });
    });
    if (run.length > 0) runs.push(run);
    return runs;
  };

  const draw = (run: { x: number; y: number }[]) =>
    run
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

  const linePath = (points: readonly TrendPoint[]) =>
    runsOf(points).map(draw).join(' ');

  const areaPath = (points: readonly TrendPoint[]) =>
    runsOf(points)
      .filter((run) => run.length > 1)
      .map((run) => {
        const last = run[run.length - 1];
        return `${draw(run)} L ${last.x.toFixed(2)} 30 L ${run[0].x.toFixed(2)} 30 Z`;
      })
      .join(' ');

  const totals = comparableTotals(lead, reference);

  return (
    <figure className={styles.root}>
      <svg
        className={styles.plot}
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        role="img"
        aria-label={accessibleName(totals)}
      >
        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop className={styles.areaTop} offset="0%" />
            <stop className={styles.areaBottom} offset="100%" />
          </linearGradient>
        </defs>
        {GRID.map((y) => (
          <line className={styles.gridline} key={y} x1="0" x2="100" y1={y} y2={y} />
        ))}
        {lead.length > 1 ? (
          <path className={styles.area} d={areaPath(lead)} fill={`url(#${areaId})`} />
        ) : null}
        {reference.length > 1 ? (
          <path className={styles.reference} d={linePath(reference)} />
        ) : null}
        {lead.length > 1 ? <path className={styles.lead} d={linePath(lead)} /> : null}
      </svg>
      <ul className={styles.legend}>
        <li className={styles.legendLead}>{t(leadLabelKey)}</li>
        <li className={styles.legendReference}>{t(referenceLabelKey)}</li>
      </ul>
    </figure>
  );
}
