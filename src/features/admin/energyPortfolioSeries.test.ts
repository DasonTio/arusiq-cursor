/**
 * The case the fixtures do not yet contain: a unit that goes silent mid-period
 * and then reports again. Every fixture gap today sits at the END of the
 * period, which is the only shape a positional join survives — so this is the
 * test that has to exist, not another pass over the current data.
 *
 * @requirement FR-61 FR-62
 */
import { describe, expect, it } from 'vitest';
import type { EnergySeries } from '../../lib/simulation/index.ts';
import { savingSeries } from './energyPortfolioSeries.ts';

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}T00:00:00.000Z`;

/** Baseline every day; the meter misses the 2nd. */
const gapInTheMiddle: EnergySeries = {
  actual: [
    { t: day(1), kWh: 10 },
    { t: day(3), kWh: 30 },
    { t: day(4), kWh: 40 },
  ],
  baseline: [
    { t: day(1), kWh: 11 },
    { t: day(2), kWh: 22 },
    { t: day(3), kWh: 33 },
    { t: day(4), kWh: 44 },
  ],
  method: { id: 'm', version: '1', href: '/method' },
  completeness: 0.75,
  provenance: 'simulated',
  levers: [],
  partialFrom: null,
};

describe('admin.energy-portfolio — saving joined by day · FR-62', () => {
  it('subtracts each day from its own baseline, not from its neighbour', () => {
    const result = savingSeries('Test Site', gapInTheMiddle);
    // Day 3 must use baseline 33, not baseline 22 — a positional join would
    // pair actual[1] (day 3) with baseline[1] (day 2) and report 22 - 30.
    expect(result.points).toEqual([
      { t: day(1), value: 1 },
      { t: day(3), value: 3 },
      { t: day(4), value: 4 },
    ]);
  });

  it('never stamps a saving with a day the meter did not report', () => {
    const result = savingSeries('Test Site', gapInTheMiddle);
    const metered = new Set(gapInTheMiddle.actual.map((point) => point.t));
    result.points.forEach((point) => {
      expect(metered.has(point.t)).toBe(true);
    });
    expect(result.points.map((point) => point.t)).not.toContain(day(2));
  });

  it('reports a metered day with no baseline as missing, not as zero saving', () => {
    const noBaseline: EnergySeries = {
      ...gapInTheMiddle,
      baseline: [{ t: day(1), kWh: 11 }],
    };
    const result = savingSeries('Test Site', noBaseline);
    expect(result.points).toEqual([
      { t: day(1), value: 1 },
      { t: day(3), value: null },
      { t: day(4), value: null },
    ]);
  });

  it('carries the property name through as the series identity', () => {
    expect(savingSeries('Rumah Bintaro', gapInTheMiddle).name).toBe('Rumah Bintaro');
  });
});
