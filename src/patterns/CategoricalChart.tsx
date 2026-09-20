/**
 * CategoricalChart — N properties, sites or units on one pair of axes
 * ("saving vs baseline by site", "consumption by unit").
 *
 * WHAT THE WRAPPER HARD-CODES, SO A SCREEN CANNOT GET IT WRONG (ADR-0007):
 *
 * - **Slot N is colour N AND a dash pattern AND an end marker.** ADR-0011
 *   measured the six-colour ramp at 10.2 ΔE for a deuteranope and guarantees
 *   colour alone only across chart-1..3. There is therefore no `color` prop and
 *   no way to draw a series in a colour without its dash: both arrive from one
 *   `.sN` class in the stylesheet, which is also the only place they are
 *   declared.
 * - **The legend is mandatory and carries the real name.** A swatch with no
 *   word beside it is the bare-dot failure in another costume (D5 UR-MNT-01).
 * - **Six slots, and the seventh does not compile.** `CategoricalSeriesSet` is
 *   a 1..6 tuple union; the runtime guard below catches the cast written to get
 *   past it. A seventh series would wrap round to chart-1 and merge two
 *   properties into one identity.
 * - **A gap stays a gap.** A null reading breaks the line rather than being
 *   interpolated across — missing is not zero (D7 §11.2).
 * - **`textAlternative` cannot be empty.** Either the chart builds the data
 *   table from the same numbers it drew, or the caller supplies a non-blank
 *   summary sentence.
 * - **Aspect-ratio box, no entrance animation, caption-size axis labels in
 *   gray-2** (D7 §12.2, §10.3).
 *
 * Drawn as inline SVG on the 100 × 30 viewBox the rest of the product already
 * uses, not with a charting library — ADR-0013 records why, and why the file
 * still lives in `src/patterns/` where the ADR-0007 wrapper boundary is.
 *
 * @requirement FR-61
 */
import type { CategoricalChartProps } from '../components/contracts.ts';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ProvenanceChip } from '../components/ProvenanceChip.tsx';
import styles from './CategoricalChart.module.css';

/** The plot box, in the shared 100 × 30 chart viewBox. Insets leave room for
 *  the end marker, which would otherwise be clipped in half at x = 100. */
const X0 = 1.5;
const X1 = 98.5;
const Y_TOP = 2;
const Y_BOTTOM = 28;
/** The third channel. Sized against `--chart-stroke-width`: a marker smaller
 *  than twice the stroke reads as a kink in the line rather than as a point. */
/* In viewBox units, so it stretches with the box. Kept small enough that the
   end marker still reads as a point rather than as a blob once the plot is a
   wide dashboard band. */
const MARKER_R = 0.7;

/** The ramp has six colours (ADR-0011). Six is the cap, not a default. */
const SLOTS = 6;

type Point = { x: number; y: number };

export function CategoricalChart({
  accessibleNameKey,
  series,
  unit,
  provenance,
  textAlternative,
  methodHref,
}: CategoricalChartProps) {
  const { t, i18n } = useTranslation();

  // Same convention as `partDefinition()` and `PartIcon`: an out-of-range
  // series count is a wiring mistake, not a data state — the type already
  // refuses both directions, this catches the cast that gets past it. Read
  // through `unknown` because `CategoricalSeriesSet["length"]` is the literal
  // union 1|2|3|4|5|6, so TS (rightly) treats a direct `=== 0` as unreachable.
  const count = (series as unknown as readonly unknown[]).length;
  if (count > SLOTS)
    throw new Error(
      `${count} series — the categorical ramp has six colours (ADR-0011). ` +
        `Use small multiples, or a "top 6 and the rest" roll-up.`,
    );
  if (count === 0)
    throw new Error(
      'a chart with no series — render the screen’s empty state instead of an empty plot',
    );
  if (textAlternative.kind === 'summary' && textAlternative.summary.trim() === '')
    throw new Error(
      'a blank text alternative — every chart carries a table, a summary sentence ' +
        'or a data-view toggle (D7 §12.2)',
    );

  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);
  /** ISO timestamps become locale dates; anything else is already a label. */
  const stampLabel = (stamp: string) =>
    Number.isNaN(Date.parse(stamp))
      ? stamp
      : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
          new Date(stamp),
        );

  // The x domain is the sorted union of every series' timestamps, so series of
  // different lengths align on time rather than on array index.
  const domain = [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort();
  const valueAt = series.map(
    (s) => new Map(s.points.map((p) => [p.t, p.value] as const)),
  );

  const plotted = series.flatMap((s) =>
    s.points.map((p) => p.value).filter((v): v is number => v !== null),
  );
  const top = plotted.length > 0 ? Math.max(...plotted) : 1;
  const floor = plotted.length > 0 ? Math.min(0, ...plotted) : 0;
  const span = top - floor || 1;

  const xOf = (index: number) =>
    domain.length <= 1 ? (X0 + X1) / 2 : X0 + (index / (domain.length - 1)) * (X1 - X0);
  const yOf = (value: number) =>
    Y_BOTTOM - ((value - floor) / span) * (Y_BOTTOM - Y_TOP);

  /** Consecutive runs of present readings. A gap ends a run; it is never
   *  bridged, because a line drawn across a missing day is a fabricated one. */
  const runsFor = (index: number): Point[][] => {
    const runs: Point[][] = [];
    let run: Point[] = [];
    domain.forEach((stamp, i) => {
      const value = valueAt[index].get(stamp);
      if (value === undefined || value === null) {
        if (run.length > 0) runs.push(run);
        run = [];
        return;
      }
      run.push({ x: xOf(i), y: yOf(value) });
    });
    if (run.length > 0) runs.push(run);
    return runs;
  };

  const pathOf = (run: Point[]) =>
    run
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

  const slotClass = (index: number) => styles[`s${index + 1}`];

  return (
    <figure className={styles.root}>
      {/* Three labelled ticks instead of one floating number. The space
          under a flat series then reads as scale rather than as a hole —
          which is what the empty half of this plot looked like. */}
      <p className={styles.scaleUnit}>{unit}</p>
      <div className={styles.plotRow}>
        <ol className={styles.ticks} aria-hidden="true">
          {[top, floor + span / 2, floor].map((value) => (
            <li key={value}>{number(value)}</li>
          ))}
        </ol>
        <svg
          className={styles.plot}
          viewBox="0 0 100 30"
          /* `meet` letterboxes the drawing inside a capped box and centres it,
           which left the y ticks describing a plot area the series were not
           actually drawn in. Filling the box exactly is what lets a tick and
           its gridline mean the same height. */
          preserveAspectRatio="none"
          role="img"
          aria-label={t(accessibleNameKey)}
          focusable="false"
        >
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
          {series.map((s, index) => {
            const runs = runsFor(index);
            const last = runs.at(-1)?.at(-1) ?? null;
            return (
              <g
                key={`${index}-${s.name}`}
                className={slotClass(index)}
                data-series={index + 1}
              >
                {runs.map((run, r) =>
                  run.length > 1 ? (
                    <path key={r} className={styles.line} d={pathOf(run)} />
                  ) : (
                    <circle
                      key={r}
                      className={styles.point}
                      cx={run[0].x}
                      cy={run[0].y}
                      r={MARKER_R}
                    />
                  ),
                )}
                {last ? (
                  <circle
                    className={styles.marker}
                    data-marker="true"
                    cx={last.x}
                    cy={last.y}
                    r={MARKER_R}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {domain.length > 0 ? (
        <p className={styles.axis}>
          <span>{stampLabel(domain[0])}</span>
          <span>{stampLabel(domain[domain.length - 1])}</span>
        </p>
      ) : null}

      <ul className={styles.legend} aria-label={t('chart.legend')}>
        {series.map((s, index) => {
          const silent = runsFor(index).length === 0;
          return (
            <li key={`${index}-${s.name}`} className={styles.legendItem}>
              <svg
                className={`${styles.swatch} ${slotClass(index)}`}
                viewBox="0 0 12 4"
                aria-hidden="true"
                focusable="false"
              >
                <path className={styles.line} d="M 0.6 2 L 8 2" />
                <circle className={styles.marker} cx="10" cy="2" r={MARKER_R} />
              </svg>
              <span className={styles.legendName}>{s.name}</span>
              {silent ? (
                <span className={styles.legendMeta}>
                  {t('loadState.noData')}
                  {s.lastSeen
                    ? ` · ${t('loadState.lastSeen', { time: stampLabel(s.lastSeen) })}`
                    : ''}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className={styles.provenance}>
        <ProvenanceChip provenance={provenance} />
      </p>

      {methodHref ? (
        <Link className={styles.method} to={methodHref}>
          {t('chart.method')}
        </Link>
      ) : null}

      {/* `figcaption` must be the first or last child of a `figure`, so the
          textual account closes the figure and nothing renders after it. */}
      {textAlternative.kind === 'summary' ? (
        <figcaption className={styles.summaryText}>
          {textAlternative.summary}
        </figcaption>
      ) : (
        <figcaption>
          <details className={styles.details}>
            <summary className={styles.disclosure}>{t('chart.dataTable')}</summary>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption className={styles.caption}>{t(accessibleNameKey)}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('chart.time')}</th>
                    {series.map((s, index) => (
                      <th key={`${index}-${s.name}`} scope="col">
                        {s.name}
                        <span className={styles.unit}>{unit}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {domain.map((stamp) => (
                    <tr key={stamp}>
                      <th scope="row">{stampLabel(stamp)}</th>
                      {series.map((s, index) => {
                        const value = valueAt[index].get(stamp);
                        return (
                          <td key={`${index}-${s.name}`}>
                            {value === undefined || value === null
                              ? t('loadState.noData')
                              : number(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {domain.length === 0 ? (
                    <tr>
                      <td colSpan={series.length + 1}>{t('loadState.noData')}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </details>
        </figcaption>
      )}
    </figure>
  );
}
