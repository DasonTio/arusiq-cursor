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
 * WHAT IT DID NOT SAY, AND NOW DOES. It drew a line in a box: no scale, no
 * dates, no unit. A reader got a shape. Three things were invisible:
 *
 * - **The scale.** Three ticks and the unit, as on `CategoricalChart`. A flat
 *   series over a labelled scale is a reading; over nothing it is a smear.
 * - **Where measurement stops.** The meter runs to yesterday while the normal
 *   runs to the end of the period, so the fill ended in a cliff two thirds
 *   across with nothing to say why. The last measured point now carries a
 *   marker and the caption names the day.
 * - **That the last day is not a whole day.** Today's reading is the energy
 *   drawn so far. True, and lower than every day beside it, which plotted
 *   bare reads as a collapse. `partialFrom` marks it hollow and says so.
 *
 * @requirement FR-61
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrendChartProps, TrendPoint } from '../components/contracts.ts';
import styles from './TrendChart.module.css';

/** The plot box inside the 100 × 30 viewBox. The insets keep an end marker
 *  from being clipped in half at the edges. */
const X0 = 1.5;
const X1 = 98.5;
const Y_TOP = 2;
const Y_BOTTOM = 28;
/** Sized as on `CategoricalChart`: smaller than twice the stroke and a marker
 *  reads as a kink in the line rather than as a point. */
const MARKER_R = 0.7;

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
  unit,
  partialFrom = null,
}: TrendChartProps) {
  const { t, i18n } = useTranslation();
  /** Two charts can share a page, so the gradient needs its own id. */
  const areaId = `${useId()}-area`;

  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  const dayLabel = (stamp: string) =>
    Number.isNaN(Date.parse(stamp))
      ? stamp
      : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
          new Date(stamp),
        );

  const max = Math.max(
    ...lead.map((point) => point.value),
    ...reference.map((point) => point.value),
    1,
  );
  const domain = [...new Set([...reference, ...lead].map((point) => point.t))].sort();
  const xAt = (stamp: string) => {
    const index = domain.indexOf(stamp);
    return domain.length <= 1
      ? (X0 + X1) / 2
      : X0 + (index / (domain.length - 1)) * (X1 - X0);
  };
  const yAt = (value: number) => Y_BOTTOM - (value / max) * (Y_BOTTOM - Y_TOP);

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
      run.push({ x: xAt(stamp), y: yAt(value) });
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
        const base = Y_BOTTOM.toFixed(2);
        return `${draw(run)} L ${last.x.toFixed(2)} ${base} L ${run[0].x.toFixed(2)} ${base} Z`;
      })
      .join(' ');

  const totals = comparableTotals(lead, reference);
  const lastMeasured = lead.at(-1) ?? null;
  const lastNormal = reference.at(-1) ?? null;
  const lastDay = domain.at(-1) ?? null;
  /** The meter stops before the period does whenever the last day of the
   *  x axis carries no measurement — a silent unit, or a month still running
   *  against a normal drawn for the whole of it. */
  const measuredShort = lastMeasured !== null && lastMeasured.t !== lastDay;
  /** The part-day belongs to the AXIS, not to one series: whichever line
   *  reaches the last day is the one drawing a fraction of it. Reading it off
   *  the lead alone left the normal plunging off the bottom of the chart with
   *  nothing to explain it, which is the shape the note exists to prevent. */
  const partialDay = partialFrom !== null && lastDay === partialFrom;
  const isPartial = (point: TrendPoint | null) =>
    partialFrom !== null && point?.t === partialFrom;

  return (
    <figure className={styles.root}>
      <p className={styles.scaleUnit}>{unit}</p>
      <div className={styles.plotRow}>
        {/* Three ticks, not one floating number: the space under a flat
            series then reads as scale rather than as a hole. */}
        <ol className={styles.ticks} aria-hidden="true">
          {[max, max / 2, 0].map((value) => (
            <li key={value}>{number(value)}</li>
          ))}
        </ol>
        <svg
          className={styles.plot}
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          role="img"
          aria-label={accessibleName(totals)}
          focusable="false"
        >
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop className={styles.areaTop} offset="0%" />
              <stop className={styles.areaBottom} offset="100%" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((fraction) => {
            const y = Y_BOTTOM - fraction * (Y_BOTTOM - Y_TOP);
            return (
              <line
                className={styles.gridline}
                key={fraction}
                x1={X0}
                x2={X1}
                y1={y}
                y2={y}
              />
            );
          })}
          {lead.length > 1 ? (
            <path className={styles.area} d={areaPath(lead)} fill={`url(#${areaId})`} />
          ) : null}
          {reference.length > 1 ? (
            <path className={styles.reference} d={linePath(reference)} />
          ) : null}
          {lead.length > 1 ? <path className={styles.lead} d={linePath(lead)} /> : null}
          {/* Where each line stops. Hollow when that last point is a part-day,
              so "not finished" and "not measured" do not share a mark. */}
          {lastNormal ? (
            <circle
              className={
                isPartial(lastNormal) ? styles.partialReference : styles.referenceMarker
              }
              data-partial={isPartial(lastNormal) ? 'true' : undefined}
              cx={xAt(lastNormal.t)}
              cy={yAt(lastNormal.value)}
              r={MARKER_R}
            />
          ) : null}
          {lastMeasured ? (
            <circle
              className={isPartial(lastMeasured) ? styles.partialMarker : styles.marker}
              data-partial={isPartial(lastMeasured) ? 'true' : undefined}
              cx={xAt(lastMeasured.t)}
              cy={yAt(lastMeasured.value)}
              r={MARKER_R}
            />
          ) : null}
        </svg>
      </div>
      {domain.length > 0 ? (
        <p className={styles.axis}>
          <span>{dayLabel(domain[0])}</span>
          <span>{dayLabel(domain[domain.length - 1])}</span>
        </p>
      ) : null}
      <ul className={styles.legend}>
        <li className={styles.legendLead}>{t(leadLabelKey)}</li>
        <li className={styles.legendReference}>{t(referenceLabelKey)}</li>
      </ul>
      {/* Both can be true at once, and routinely are: a meter that stopped on
          Sunday against a normal drawn to a Wednesday that is still running.
          Showing one and swallowing the other left half the chart unexplained. */}
      {measuredShort && lastMeasured ? (
        <p className={styles.note}>
          {t('chart.measuredTo', { time: dayLabel(lastMeasured.t) })}
        </p>
      ) : null}
      {partialDay ? <p className={styles.note}>{t('chart.partialDay')}</p> : null}
    </figure>
  );
}
