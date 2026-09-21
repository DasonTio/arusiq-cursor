import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText(/Nothing is purchased or retired/)).toBeInTheDocument();
    expect(screen.queryByText(/ppm/i)).not.toBeInTheDocument();
  });

  it('shows the overdue balance, the pay path and the restriction ladder', async () => {
    wrap(<Billing />, '/account');
    expect(
      await screen.findByRole('heading', { name: 'Bills & notices' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pay this bill' })).toHaveAttribute(
      'href',
      '/account?pay=balance',
    );
    expect(screen.getByText('The four steps')).toBeInTheDocument();
    expect(screen.getByText('Service stopped')).toBeInTheDocument();
    expect(
      screen.getAllByText('Stop is blocked on health-sensitive spaces.').length,
    ).toBeGreaterThan(0);
  });

  it('draws all four rungs, in order, with their state in words', async () => {
    // FR-52 — the ladder is the safety guarantee, so it renders whole
    // whatever rung is in force: the reader has to be able to see that `stop`
    // is unreachable WITHOUT having to arrive at it.
    wrap(<Billing />, '/account');
    const ladder = await screen.findByRole('list', { name: 'The four steps' });
    const rungs = within(ladder).getAllByRole('listitem');
    expect(rungs.length).toBe(4);
    expect(within(ladder).getAllByText('Passed').length).toBeGreaterThan(0);
    expect(within(ladder).getByText('In force now')).toBeInTheDocument();
  });

  it('makes every notice openable — a notice is not a dead end', async () => {
    // The restriction below was first explained on one of these notices
    // (INV-NO-DEAD-END). The row itself is the link, so there is no button.
    wrap(<Billing />, '/account');
    await screen.findByRole('heading', { name: 'Bills & notices' });
    const notices = screen.getAllByRole('link', { name: /Open notice/ });
    expect(notices.length).toBeGreaterThan(0);
    notices.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/^\/alerts\?alert=/);
    });
  });

  it('says nothing about being a simulation — ADR-0020', async () => {
    // The owner's decision: the prototype is disclosed at the presentation,
    // so the screens do not repeat it. This is the screen that carried it
    // four times over.
    const { container } = wrap(<Billing />, '/account');
    await screen.findByRole('heading', { name: 'Bills & notices' });
    expect(container.textContent ?? '').not.toMatch(/simulat|mock|prototype/i);
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
    await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
    expect(
      screen.getByText('Restore request sent — awaiting device verification.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Restriction remains in force until verification/),
    ).toBeInTheDocument();
  });
});
