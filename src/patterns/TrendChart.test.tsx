/**
 * The two defects that were duplicated across three hand-rolled copies of this
 * chart, pinned once at the component instead of once per screen.
 *
 * @requirement FR-61
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from './TrendChart.tsx';

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}T00:00:00.000Z`;

/** A meter that stops three days early against a complete normal. */
const lead = [1, 2, 3, 4].map((n) => ({ t: day(n), value: 10 }));
const reference = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ t: day(n), value: 12 }));

function renderChart(overrides: Partial<React.ComponentProps<typeof TrendChart>> = {}) {
  return render(
    <TrendChart
      lead={lead}
      reference={reference}
      accessibleName={(totals) => `lead ${totals.lead} reference ${totals.reference}`}
      leadLabelKey="client.energy.actualSeries"
      referenceLabelKey="client.energy.baselineSeries"
      {...overrides}
    />,
  );
}

describe('TrendChart — the invariants three copies each got wrong', () => {
  it('totals the reference over the days the lead also reports', () => {
    // 7 reference points at 12 is 84, but only 4 days are comparable: 48.
    // Summing all of them reports three missing days as a saving.
    renderChart();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'lead 40 reference 48',
    );
  });

  it('puts both series on one axis, so the shorter one ends sooner', () => {
    const { container } = renderChart();
    const endOf = (selector: string) => {
      const d = container.querySelector(selector)?.getAttribute('d') ?? '';
      const parts = d.trim().split(' ');
      return Number(parts[parts.length - 2]);
    };
    // Scaling each series across its OWN length put both at x=100 and stacked
    // a 4-day meter on top of a 7-day normal.
    expect(endOf('path[class*="reference"]')).toBeCloseTo(100, 1);
    expect(endOf('path[class*="lead"]')).toBeLessThan(100);
  });

  it('breaks the line AND the fill on a gap in the middle', () => {
    const gapped = [
      { t: day(1), value: 10 },
      { t: day(2), value: 10 },
      // day 3 silent
      { t: day(4), value: 10 },
      { t: day(5), value: 10 },
    ];
    const { container } = renderChart({ lead: gapped });
    const line =
      container.querySelector('path[class*="lead"]')?.getAttribute('d') ?? '';
    const area =
      container.querySelector('path[class*="area"]')?.getAttribute('d') ?? '';
    // Two runs means two `M` commands in both channels — a silent day is
    // never drawn through, and never filled under.
    expect((line.match(/M/g) ?? []).length).toBe(2);
    expect((area.match(/M/g) ?? []).length).toBe(2);
  });

  it('anchors the fill at the floor of the plot, not at the first reading', () => {
    const { container } = renderChart();
    const area =
      container.querySelector('path[class*="area"]')?.getAttribute('d') ?? '';
    // The closing edge drops to y=30: the filled area is the quantity.
    expect(area).toMatch(/ 30 /);
    expect(area.trim().endsWith('Z')).toBe(true);
  });

  it('draws no line or fill for a single reading', () => {
    const { container } = renderChart({ lead: [{ t: day(1), value: 10 }] });
    expect(container.querySelector('path[class*="lead"]')).toBeNull();
    expect(container.querySelector('path[class*="area"]')).toBeNull();
  });

  it('gives each chart its own gradient, so two can share a page', () => {
    const one = (
      <TrendChart
        lead={lead}
        reference={reference}
        accessibleName={() => 'first'}
        leadLabelKey="client.energy.actualSeries"
        referenceLabelKey="client.energy.baselineSeries"
      />
    );
    const two = (
      <TrendChart
        lead={lead}
        reference={reference}
        accessibleName={() => 'second'}
        leadLabelKey="client.energy.actualSeries"
        referenceLabelKey="client.energy.baselineSeries"
      />
    );
    const { container } = render(
      <div>
        {one}
        {two}
      </div>,
    );
    // A shared id would make the second chart paint with the first one's
    // gradient, or lose its fill entirely depending on document order.
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
