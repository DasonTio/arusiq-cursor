import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Payments from './Payments.tsx';

const hq = { userId: 'user-admin', role: 'admin' as const, name: 'HQ Ops' };

function renderPayments() {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={['/accounts']}>
        <Payments />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('admin.payments — account standing with restriction cases · FR-51 FR-52', () => {
  it('puts every account in one table with named columns, not stacked-sentence cards', async () => {
    renderPayments();
    const table = await screen.findByRole('table');
    for (const column of [
      'Site',
      'Standing',
      'Balance',
      'Due',
      'Rung',
      'Approvals',
      'Action',
    ]) {
      expect(
        within(table).getByRole('columnheader', { name: column }),
      ).toBeInTheDocument();
    }
    // Site names are row headers.
    expect(within(table).getAllByRole('rowheader').length).toBeGreaterThan(0);
  });

  it('keeps the Metric balance so provenance stays declared on the figure', async () => {
    renderPayments();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByText('Balance due').length).toBeGreaterThan(0);
  });

  it('links a restricted account into its restriction case', async () => {
    renderPayments();
    const links = await screen.findAllByRole('link', { name: 'Open case' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/accounts/case?property=');
    }
  });
});
