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
      unit="kWh"
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
    // Scaling each series across its OWN length put both at the right edge
    // and stacked a 4-day meter on top of a 7-day normal. The edge is 98.5,
    // not 100: the plot is inset so an end marker is not clipped in half.
    expect(endOf('path[class*="reference"]')).toBeCloseTo(98.5, 1);
    expect(endOf('path[class*="lead"]')).toBeLessThan(98.5);
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
    // The closing edge drops to the floor of the plot box: the filled area
    // is the quantity, not the distance from the first reading.
    expect(area).toMatch(/ 28\.00 /);
    expect(area.trim().endsWith('Z')).toBe(true);
  });

  it('draws no line or fill for a single reading', () => {
    const { container } = renderChart({ lead: [{ t: day(1), value: 10 }] });
    expect(container.querySelector('path[class*="lead"]')).toBeNull();
    expect(container.querySelector('path[class*="area"]')).toBeNull();
  });

  it('names the scale it is drawn against', () => {
    // A line in an unlabelled box is a shape. Three ticks and a unit make it
    // a reading — this chart had neither, on three screens.
    renderChart();
    expect(screen.getByText('kWh')).toBeInTheDocument();
    // max is 12 (the reference), so the ticks are 12 · 6 · 0.
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('says where the measurement stops when the normal outruns it', () => {
    // The fill ended two thirds across the box with nothing to say why, which
    // reads as a broken chart rather than as a month still running.
    renderChart();
    expect(screen.getByText(/Measured to/)).toBeInTheDocument();
  });

  it('marks a final part-day hollow and says so, rather than drawing a collapse', () => {
    // Today's reading is the energy drawn SO FAR. True, and lower than every
    // whole day beside it — plotted bare it reads as consumption collapsing.
    // The part-day is the LAST DAY OF THE AXIS, which here only the normal
    // reaches: reading it off the measured series left the normal diving off
    // the chart with nothing to explain it.
    const { container } = renderChart({ partialFrom: day(7) });
    expect(screen.getByText(/today so far/i)).toBeInTheDocument();
    const hollow = container.querySelectorAll('circle[data-partial="true"]');
    expect(hollow).toHaveLength(1);
    // The meter stopped three days earlier, so its own end is a whole day and
    // is NOT hollow — and the chart says where it stopped.
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(screen.getByText(/Measured to/)).toBeInTheDocument();
  });

  it('marks the measured series hollow when IT is the line reaching today', () => {
    const wholeMonth = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ t: day(n), value: 10 }));
    const { container } = renderChart({ lead: wholeMonth, partialFrom: day(7) });
    expect(container.querySelectorAll('circle[data-partial="true"]')).toHaveLength(2);
    // Both lines reach the last day, so nothing is "measured to" anything.
    expect(screen.queryByText(/Measured to/)).not.toBeInTheDocument();
  });

  it('leaves both end marks solid when the period is over', () => {
    const { container } = renderChart({ partialFrom: null });
    expect(container.querySelector('circle[data-partial="true"]')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(screen.queryByText(/today so far/i)).not.toBeInTheDocument();
  });

  it('gives each chart its own gradient, so two can share a page', () => {
    const one = (
      <TrendChart
        lead={lead}
        reference={reference}
        accessibleName={() => 'first'}
        leadLabelKey="client.energy.actualSeries"
        referenceLabelKey="client.energy.baselineSeries"
        unit="kWh"
      />
    );
    const two = (
      <TrendChart
        lead={lead}
        reference={reference}
        accessibleName={() => 'second'}
        leadLabelKey="client.energy.actualSeries"
        referenceLabelKey="client.energy.baselineSeries"
        unit="kWh"
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
