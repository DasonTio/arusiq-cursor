/**
 * Tests for client.energy — the sparkline and the sentence beside it must
 * describe the same days. Rumah Bintaro reports 27 actual days against a
 * 30-day baseline (three units went silent), which is the case that exposed
 * both defects these tests pin down.
 *
 * @requirement FR-60 FR-61
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import {
  REFERENCE_NOW,
  simulatedTelemetry,
  trailingPeriod,
} from '../../lib/simulation/index.ts';
import Energy from './Energy.tsx';

const client = { userId: 'user-client', role: 'client' as const, name: 'Siti Rahayu' };

function renderEnergy() {
  return render(
    <SessionProvider initialSession={client}>
      <MemoryRouter initialEntries={['/insights/energy']}>
        <Energy />
      </MemoryRouter>
    </SessionProvider>,
  );
}

const ALT = /Actual ([\d.,]+) kilowatt-hours against a normal of ([\d.,]+)\./;

describe('client.energy — actual and baseline describe the same days · FR-61', () => {
  it('gives the chart the same figures as the sentence beside it', async () => {
    // The screen renders `chartAlt` twice: as a visible paragraph, and as the
    // chart's aria-label. They were computed differently — the paragraph
    // filtered the baseline to reported days, the chart did not — so a
    // screen-reader user was read a larger "normal" than the page showed, and
    // the three silent days were reported as a saving.
    renderEnergy();
    const chart = await screen.findByRole('img', { name: ALT });
    const spoken = chart.getAttribute('aria-label') ?? '';
    const shown = screen.getByText(ALT).textContent ?? '';
    expect(spoken).toBe(shown);
  });

  it('never compares a 30-day normal against a 27-day meter', async () => {
    // Pinned to the adapter's own figures rather than to a guessed threshold.
    // Bintaro has a real, material saving on its matched days; summing the
    // whole baseline inflates the "normal" by three further days of
    // consumption on top of it, and the chart then reports the sum as saved.
    const scope = { role: client.role, userId: client.userId };
    const period = trailingPeriod(new Date(REFERENCE_NOW), 30);
    const series = await simulatedTelemetry.getEnergy(scope, 'prop-bintaro', period);
    const reported = new Set(series.actual.map((point) => point.t));
    const matched = series.baseline
      .filter((point) => reported.has(point.t))
      .reduce((sum, point) => sum + point.kWh, 0);
    const whole = series.baseline.reduce((sum, point) => sum + point.kWh, 0);
    // The fixture must keep exercising this case, or the test proves nothing.
    expect(series.actual.length).toBeLessThan(series.baseline.length);
    expect(whole).toBeGreaterThan(matched);

    renderEnergy();
    const chart = await screen.findByRole('img', { name: ALT });
    const match = ALT.exec(chart.getAttribute('aria-label') ?? '');
    const baseline = Number(match?.[2].replace(/,/g, ''));
    expect(baseline).toBeCloseTo(Math.round(matched * 10) / 10, 1);
  });

  it('breaks the meter line on a silent day instead of drawing through it', async () => {
    const { container } = renderEnergy();
    await screen.findByRole('img', { name: ALT });
    const actualLine = container.querySelector('path[class*="lead"]');
    expect(actualLine).not.toBeNull();
    const d = actualLine?.getAttribute('d') ?? '';
    // Every path starts with one M. A second M is a deliberate gap, and the
    // absence of one here means the line is continuous — which is correct for
    // Bintaro, whose silent days fall at the end of the period rather than in
    // the middle. What must never happen is a point drawn ON a silent day.
    expect(d.startsWith('M')).toBe(true);
    const points = d.split(/[ML]/).filter((part) => part.trim() !== '');
    expect(points.length).toBe(27);
  });

  it('draws both lines on one time axis, not each stretched to full width', async () => {
    const { container } = renderEnergy();
    await screen.findByRole('img', { name: ALT });
    const lastX = (selector: string) => {
      const d = container.querySelector(selector)?.getAttribute('d') ?? '';
      const coords = d.trim().split(' ');
      return Number(coords[coords.length - 2]);
    };
    const baselineEnd = lastX('path[class*="reference"]');
    const actualEnd = lastX('path[class*="lead"]');
    // The baseline covers three more days, so it must reach further right.
    // Both ending at the same x is the bug: two different spans, one width.
    // The right edge is 98.5 — the plot is inset so an end marker drawn on
    // the last point is not clipped in half.
    expect(baselineEnd).toBeCloseTo(98.5, 1);
    expect(actualEnd).toBeLessThan(baselineEnd);
  });
});
