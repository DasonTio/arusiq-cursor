/**
 * Scope 2 emissions, and emissions AVOIDED.
 *
 * Two rules the rest of the product depends on:
 *
 * - The grid factor is displayed, never hidden (D6 FR-70). A carbon figure
 *   without its versioned factor, source and effective date is unauditable, so
 *   the factor is part of the summary rather than a page footnote.
 * - The word "credit" does not appear (INV-CREDIT, D5 UR-CAR-08). It is
 *   permissible only under `verified` provenance and Phase 1A has none. The
 *   figure is *avoided emissions*, and its label is computed rather than
 *   chosen: `weakestProvenance` over simulated telemetry returns `simulated`,
 *   which is the truthful answer for a prototype.
 *
 * This file never touches indoor CO₂ ppm. Air freshness is a property of a
 * room and lives with the room (INV-CO2).
 *
 * @requirement FR-70 FR-71
 */
import { weakestProvenance } from '../domain/provenance.ts';
import { buildEnergySeries, savingVsBaseline, totalKWh } from './energy.ts';
import { GRID_FACTOR } from './fixtures.ts';
import { round } from './random.ts';
import type { SimDataset } from './build.ts';
import type { CarbonSummary, EnergySeries, Period, Reading } from './types.ts';

export const gridFactor = () => GRID_FACTOR;

/**
 * kWh × versioned grid factor. The provenance of the product is the weakest
 * provenance of its inputs — in Phase 1A the kWh is simulated, so the emission
 * figure is simulated no matter how exact the factor is.
 */
export const emissionsFrom = (
  kWh: number | null,
  series: EnergySeries,
  lastSeen: string | null,
): Reading => ({
  value: kWh === null ? null : round(kWh * GRID_FACTOR.value, 1),
  provenance: weakestProvenance([series.provenance]),
  lastSeen,
});

export const buildCarbonSummary = (
  dataset: SimDataset,
  assetId: string,
  period: Period,
): CarbonSummary => {
  const series = buildEnergySeries(dataset, assetId, period);
  const lastSeen = series.actual.at(-1)?.t ?? null;
  const saving = savingVsBaseline(series);

  return {
    scope2KgCO2e: emissionsFrom(
      series.actual.length === 0 ? null : totalKWh(series.actual),
      series,
      lastSeen,
    ),
    // An avoided figure rests on a counterfactual as well as a meter, so its
    // inputs include `estimated`. In Phase 1A the meter is simulated and
    // therefore still the weakest link.
    avoidedKgCO2e: {
      value:
        saving.kWh.value === null
          ? null
          : round(saving.kWh.value * GRID_FACTOR.value, 1),
      provenance: weakestProvenance([series.provenance, 'estimated']),
      lastSeen,
    },
    gridFactor: GRID_FACTOR,
  };
};
