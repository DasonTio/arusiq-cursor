/**
 * The saving-vs-baseline join for admin.energy-portfolio.
 *
 * Split out of `EnergyPortfolio.tsx` so it can be tested against a gap in the
 * middle of a period — fast refresh also wants that file to export only its
 * component, the same reason `categoricalSeries.ts` exists.
 *
 * @requirement FR-61 FR-62
 */
import type { ChartSeries } from '../../components/contracts.ts';
import type { EnergySeries } from '../../lib/simulation/index.ts';

/**
 * One chart series per property: the saving for each metered day, joined to
 * its baseline BY DAY.
 *
 * The generator emits a baseline for every day in the period but skips
 * `actual` on any day a unit was silent, so the two arrays are routinely
 * different lengths — Rumah Bintaro runs 27 against 30. A positional join
 * survives only while every gap sits at the end of the period. The first unit
 * that goes quiet and then reports again shifts every later point onto an
 * earlier day's baseline and stamps the result with the meter's date, which
 * is a saving nobody measured. `savingVsBaseline` in `energy.ts` has guarded
 * against the same mistake since it was written.
 */
export function savingSeries(name: string, series: EnergySeries): ChartSeries {
  const baselineByDay = new Map(
    series.baseline.map((point) => [point.t, point.kWh] as const),
  );
  return {
    name,
    points: series.actual.map((point) => {
      const baseline = baselineByDay.get(point.t);
      return {
        t: point.t,
        // No baseline for a metered day is a gap, not a zero saving.
        value: baseline === undefined ? null : baseline - point.kWh,
      };
    }),
  };
}
