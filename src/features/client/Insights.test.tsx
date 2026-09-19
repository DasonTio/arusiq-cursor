import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Energy from './Energy.tsx';
import Carbon from './Carbon.tsx';
import Billing from './Billing.tsx';

const household = {
  userId: 'user-client',
  role: 'client' as const,
  name: 'Sari Wijaya',
};

function wrap(ui: ReactElement, path: string) {
  return render(
    <SessionProvider initialSession={household}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </SessionProvider>,
  );
}

describe('client insights and account — FR-50 FR-60 FR-61 FR-70', () => {
  it('shows energy, tariff, method link and lever actions', async () => {
    wrap(<Energy />, '/insights');
    expect(
      await screen.findByRole('heading', { name: 'Energy & cost' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tariff/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'How this was calculated' }),
    ).toHaveAttribute('href', expect.stringContaining('/insights?method='));
    expect(screen.getByText('Eco mode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See filter alerts' })).toHaveAttribute(
      'href',
      '/alerts',
    );
  });

  it('opens the method room from the energy query', async () => {
    wrap(<Energy />, '/insights?method=adjusted-baseline-v2');
    expect(
      await screen.findByRole('heading', { name: 'How these numbers are made' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Indoor CO₂ in ppm/)).toBeInTheDocument();
    expect(screen.getByText(/kgCO₂e is electricity emissions/)).toBeInTheDocument();
  });

  it('shows scope 2 and avoided emissions with the grid factor, never indoor CO₂', async () => {
    wrap(<Carbon />, '/insights/carbon');
    expect(await screen.findByRole('heading', { name: 'Carbon' })).toBeInTheDocument();
    expect(screen.getByText('Scope 2 this period')).toBeInTheDocument();
    expect(screen.getByText('Avoided emissions')).toBeInTheDocument();
    expect(screen.getByText(/Grid factor/)).toBeInTheDocument();
    expect(screen.getByText(/Offset retirement is mocked/)).toBeInTheDocument();
    expect(screen.queryByText(/ppm/i)).not.toBeInTheDocument();
  });

  it('shows the overdue balance, mocked pay path and the restriction ladder', async () => {
    wrap(<Billing />, '/account');
    expect(
      await screen.findByRole('heading', { name: 'Bills & notices' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText(/Payment collection is simulated/)).toBeInTheDocument();
    expect(screen.getByText('The four steps')).toBeInTheDocument();
    expect(screen.getByText('Service stopped')).toBeInTheDocument();
    expect(
      screen.getAllByText('Stop is blocked on health-sensitive spaces.').length,
    ).toBeGreaterThan(0);
  });

  it('completes a mocked payment hand-off without settling the restriction', async () => {
    const user = userEvent.setup();
    wrap(<Billing />, '/account?pay=balance');
    expect(
      await screen.findByRole('heading', { name: 'Pay this bill' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/No real payment will be collected/).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Virtual account' }));
    await user.click(screen.getByRole('button', { name: 'Confirm simulated payment' }));
    expect(
      screen.getByText('Restore request sent — awaiting device verification.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Restriction remains in force until verification/),
    ).toBeInTheDocument();
  });
});
