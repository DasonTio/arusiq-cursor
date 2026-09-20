/**
 * The branch no fixture reaches: a site below the FR-71 threshold.
 *
 * @requirement FR-71
 */
import { describe, expect, it } from 'vitest';
import type { EnergySeries, Property } from '../../lib/simulation/index.ts';
import {
  MRV_COMPLETENESS_THRESHOLD,
  portfolioCompleteness,
  type PortfolioRow,
} from './portfolioCompleteness.ts';

const site = (
  name: string,
  completeness: number,
  provenance: EnergySeries['provenance'] = 'simulated',
): PortfolioRow => ({
  property: { id: name, name } as Property,
  series: {
    actual: [],
    baseline: [],
    method: { id: 'm', version: '1', href: '/insights?method=m' },
    completeness,
    provenance,
    levers: [],
  },
});

describe('portfolioCompleteness — FR-71', () => {
  it('is the mean across sites, not the first site', () => {
    const result = portfolioCompleteness([site('A', 0.9), site('B', 1)]);
    expect(result?.completeness).toBeCloseTo(0.95, 5);
  });

  it('names a site under the threshold', () => {
    const result = portfolioCompleteness([
      site('Healthy', 1),
      site('Patchy', 0.62),
      site('Also fine', 0.98),
    ]);
    // The mean here is 0.867 — above nothing useful, and it would have hidden
    // Patchy entirely. That is the case this branch exists for.
    expect(result?.weakest?.property.name).toBe('Patchy');
  });

  it('picks the lowest when several are under', () => {
    const result = portfolioCompleteness([site('A', 0.7), site('B', 0.5)]);
    expect(result?.weakest?.property.name).toBe('B');
  });

  it('names nobody when every site has met the method', () => {
    // Not "the lowest site" — that would put a blameless name on a healthy
    // estate and teach an approver to ignore the line.
    const result = portfolioCompleteness([site('A', 1), site('B', 0.95)]);
    expect(result?.weakest).toBeNull();
  });

  it('treats exactly the threshold as met, because FR-71 says below', () => {
    const result = portfolioCompleteness([site('A', MRV_COMPLETENESS_THRESHOLD)]);
    expect(result?.weakest).toBeNull();
  });

  it('inherits the weakest provenance of its inputs — INV-AGGREGATE', () => {
    // `simulated` outranks nothing: rank 0 is the weakest, so one simulated
    // site makes the whole portfolio figure simulated (D8, provenance.ts).
    expect(
      portfolioCompleteness([site('A', 1, 'simulated'), site('B', 1, 'estimated')])
        ?.provenance,
    ).toBe('simulated');
    expect(
      portfolioCompleteness([site('A', 1, 'verified'), site('B', 1, 'provisional')])
        ?.provenance,
    ).toBe('provisional');
  });

  it('is null for an empty estate rather than a fabricated 0 %', () => {
    expect(portfolioCompleteness([])).toBeNull();
  });
});
