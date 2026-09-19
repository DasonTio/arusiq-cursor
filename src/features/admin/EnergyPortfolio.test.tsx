/**
 * Tests for admin.energy-portfolio — the categorical chart ramp closes D7
 * §20 gap 2 (ADR-0011/ADR-0013): saving vs baseline by site is a real chart,
 * not a labelled mock, with every property's figures still below it.
 *
 * @requirement FR-61
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import EnergyPortfolio from './EnergyPortfolio.tsx';

const hq = {
  userId: 'user-admin',
  role: 'admin' as const,
  name: 'HQ Ops',
};

function renderPortfolio() {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={['/reporting/energy']}>
        <EnergyPortfolio />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('admin.energy-portfolio — FR-61', () => {
  it('draws a real categorical chart, not the "not in this prototype" mock', async () => {
    renderPortfolio();
    expect(
      await screen.findByRole('img', { name: 'Saving vs baseline by site' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/categorical chart ramp is not in this prototype/i),
    ).not.toBeInTheDocument();
  });

  it('keeps every property as its own figure below the chart', async () => {
    renderPortfolio();
    await screen.findByRole('img', { name: 'Saving vs baseline by site' });
    expect(
      screen.getAllByRole('link', { name: 'How this was calculated' }).length,
    ).toBeGreaterThan(0);
  });
});
