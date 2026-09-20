/**
 * Completeness across the estate, for `admin.overview`'s portfolio glance.
 *
 * Split out of `Overview.tsx` so the under-threshold branch can be tested —
 * no fixture produces a site below 90 % today, and an untested branch on a
 * governance figure is the one that is wrong when it finally renders. Fast
 * refresh also wants that file to export only its component, the same reason
 * `energyPortfolioSeries.ts` exists.
 *
 * @requirement FR-71
 */
import { weakestProvenance, type Provenance } from '../../lib/domain/provenance.ts';
import type { EnergySeries, Property } from '../../lib/simulation/index.ts';

/** D6 FR-71 — BELOW this a derived MRV package is provisional, not verified.
 *  Strict: a site sitting exactly on 90 % has met the method, not missed it. */
export const MRV_COMPLETENESS_THRESHOLD = 0.9;

export interface PortfolioRow {
  property: Property;
  series: EnergySeries;
}

export interface PortfolioCompleteness {
  completeness: number;
  provenance: Provenance;
  /** The site dragging the portfolio down, when one is under the threshold.
   *  `null` when every site has met the method — not "the lowest site", which
   *  would name a blameless one on a healthy estate. */
  weakest: PortfolioRow | null;
}

/**
 * Every site is read over the SAME period, so the plain mean is exactly the
 * days-weighted figure. If that ever stops being true this has to weight by
 * days; the assumption is written down rather than assumed silently.
 */
export function portfolioCompleteness(
  rows: readonly PortfolioRow[],
): PortfolioCompleteness | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.series.completeness, 0);
  const weakest = rows
    .filter((row) => row.series.completeness < MRV_COMPLETENESS_THRESHOLD)
    .reduce<PortfolioRow | null>(
      (worst, row) =>
        worst === null || row.series.completeness < worst.series.completeness
          ? row
          : worst,
      null,
    );
  return {
    completeness: total / rows.length,
    provenance: weakestProvenance(rows.map((row) => row.series.provenance)),
    weakest,
  };
}
