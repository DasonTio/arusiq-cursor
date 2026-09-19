/**
 * Metered energy and the adjusted baseline it is compared against.
 *
 * D6 FR-61 is the product's headline claim, and the two things that make it a
 * measurement rather than a marketing number are the METHOD and the
 * COMPLETENESS. Both are fields on the series, not annotations a screen may
 * forget, and the chart contract refuses to render without them.
 *
 * HOW A GAP IS HANDLED. A unit that did not report does not contribute a zero.
 * Its day is absent from `actual`, and `completeness` falls. For an asset above
 * the unit, a day is included only when every unit beneath it reported: a
 * property total assembled from two thirds of its units is not the property's
 * consumption, and presenting it as one is the fabrication the invariant
 * forbids.
 *
 * @requirement FR-60 FR-61 FR-62
 */
import { weakestProvenance } from '../domain/provenance.ts';
import type { Provenance } from '../domain/provenance.ts';
import { DAY_MS, daysBefore, startOfLocalDay } from './clock.ts';
import { BASELINE_METHOD, SAVING_LEVERS, TARIFF } from './fixtures.ts';
import { links } from './links.ts';
import { createRng, round } from './random.ts';
import type { SimDataset } from './build.ts';
import type { EnergySeries, Period, Reading } from './types.ts';

export const energyMethod = (): EnergySeries['method'] => ({
  id: BASELINE_METHOD.id,
  version: BASELINE_METHOD.version,
  href: links.method(BASELINE_METHOD.id),
});

export const emptyEnergySeries = (): EnergySeries => ({
  actual: [],
  baseline: [],
  method: energyMethod(),
  completeness: 0,
  provenance: 'simulated',
  levers: [],
});

/** A unit's counterfactual is 14–22 % above what it actually drew: the
 *  adjusted baseline is what it WOULD have consumed without the solution. */
const BASELINE_UPLIFT = { min: 1.14, max: 1.22 };

interface DayPoint {
  t: string;
  actual: number | null;
  baseline: number;
}

/**
 * One unit's daily meter, plus the days it was silent. `null` actual means the
 * unit did not report that day — it is NOT zero, and the distinction is the
 * whole reason this returns a nullable field instead of a number.
 */
const unitDays = (
  dataset: SimDataset,
  unitId: string,
  days: Date[],
  now: Date,
): DayPoint[] => {
  const spec = dataset.index.specById.get(unitId);
  if (!spec) return [];
  const rng = createRng(`energy:${unitId}`);
  const unit = dataset.index.unitById.get(unitId);
  const lastHeartbeat = unit?.device.lastHeartbeat;
  // Silence starts at the last heartbeat and runs to now, so an offline unit's
  // gap is exactly as long as the outage the device record already states.
  const silentFrom =
    unit && !unit.device.online && lastHeartbeat ? Date.parse(lastHeartbeat) : null;

  return days.map((day) => {
    const uplift = rng.float(BASELINE_UPLIFT.min, BASELINE_UPLIFT.max, 3);
    const actual = round(spec.baseDailyKWh * rng.float(0.82, 1.18, 3), 2);
    const isToday = day.getTime() === startOfLocalDay(now).getTime();
    const partial = isToday ? (now.getTime() - day.getTime()) / DAY_MS : 1;
    const reported = silentFrom === null || day.getTime() + DAY_MS <= silentFrom;
    return {
      t: day.toISOString(),
      actual: reported ? round(actual * partial, 2) : null,
      baseline: round(actual * uplift * partial, 2),
    };
  });
};

const localDaysBack = (now: Date, count: number): Date[] => {
  const today = startOfLocalDay(now);
  return Array.from(
    { length: count },
    (_, i) => new Date(today.getTime() - (count - 1 - i) * DAY_MS),
  );
};

/**
 * Builds the series for any asset id — a unit, a room, a floor or a whole
 * property. Above the unit the days are summed, and a day with any silent unit
 * is dropped rather than under-reported.
 */
export const buildEnergySeries = (
  dataset: SimDataset,
  assetId: string,
  period: Period,
): EnergySeries => {
  const now = new Date(dataset.generatedAt);
  const from = new Date(period.from);
  const to = new Date(period.to);
  const dayCount = Math.max(
    1,
    Math.round(
      (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS,
    ) + 1,
  );
  const days = localDaysBack(to, dayCount);
  const unitIds = dataset.index.unitIdsByAsset.get(assetId) ?? [];

  const perUnit = unitIds.map((id) => unitDays(dataset, id, days, now));

  const actual: EnergySeries['actual'] = [];
  const baseline: EnergySeries['baseline'] = [];
  let complete = 0;

  days.forEach((day, i) => {
    const points = perUnit.map((u) => u[i]).filter(Boolean);
    if (points.length === 0) return;
    const anySilent = points.some((p) => p.actual === null);
    const t = day.toISOString();
    baseline.push({
      t,
      kWh: round(
        points.reduce((s, p) => s + p.baseline, 0),
        2,
      ),
    });
    if (anySilent) return;
    complete += 1;
    actual.push({
      t,
      kWh: round(
        points.reduce((s, p) => s + (p.actual ?? 0), 0),
        2,
      ),
    });
  });

  const completeness = days.length === 0 ? 0 : round(complete / days.length, 3);
  const savedKWh = Math.max(
    0,
    round(
      baseline
        .filter((b) => actual.some((a) => a.t === b.t))
        .reduce((s, b) => s + b.kWh, 0) - actual.reduce((s, a) => s + a.kWh, 0),
      2,
    ),
  );

  // A property billed from one apportioned utility invoice is an ESTIMATE, not
  // a meter reading, and every figure derived from it inherits that
  // (INV-AGGREGATE). The label is decided here, at the source.
  const basis: Provenance = assetBasis(dataset, assetId);

  return {
    actual,
    baseline,
    method: energyMethod(),
    completeness,
    provenance: basis,
    levers: SAVING_LEVERS.map((l) => ({
      key: l.key,
      kWh: round(savedKWh * l.share, 2),
    })),
  };
};

/** Where the kWh behind an asset comes from, as a provenance label. */
export const assetBasis = (dataset: SimDataset, assetId: string): Provenance => {
  for (const [propertyId, spec] of dataset.index.propertySpecById) {
    const unitIds = dataset.index.unitIdsByAsset.get(propertyId) ?? [];
    const target = dataset.index.unitIdsByAsset.get(assetId) ?? [];
    if (target.length > 0 && target.every((id) => unitIds.includes(id))) {
      return spec.energyBasis === 'metered' ? 'simulated' : 'estimated';
    }
  }
  return 'simulated';
};

/** The last `count` local days, ending today. */
export const trailingPeriod = (now: Date, count: number): Period => ({
  from: daysBefore(now, count - 1),
  to: now.toISOString(),
});

export const totalKWh = (points: readonly { kWh: number }[]): number =>
  round(
    points.reduce((s, p) => s + p.kWh, 0),
    2,
  );

/**
 * Saving against the adjusted baseline. Only days present in BOTH series are
 * compared: subtracting a 30-day baseline from a 28-day meter would invent a
 * saving out of two missing days.
 */
export const savingVsBaseline = (
  series: EnergySeries,
): { kWh: Reading; pct: Reading; idr: Reading } => {
  const reported = new Set(series.actual.map((a) => a.t));
  const baseline = totalKWh(series.baseline.filter((b) => reported.has(b.t)));
  const actual = totalKWh(series.actual);
  const provenance = weakestProvenance([series.provenance, 'estimated']);

  if (series.actual.length === 0) {
    const nothing: Reading = { value: null, provenance, lastSeen: null };
    return { kWh: nothing, pct: nothing, idr: nothing };
  }

  const savedKWh = round(baseline - actual, 2);
  return {
    kWh: { value: savedKWh, provenance, lastSeen: series.actual.at(-1)?.t ?? null },
    pct: {
      value: baseline === 0 ? null : round((savedKWh / baseline) * 100, 1),
      provenance,
      lastSeen: series.actual.at(-1)?.t ?? null,
    },
    idr: {
      value: Math.round(savedKWh * TARIFF.idrPerKWh),
      provenance,
      lastSeen: series.actual.at(-1)?.t ?? null,
    },
  };
};
