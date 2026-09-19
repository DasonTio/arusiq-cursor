import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('links a restricted account into its restriction case', async () => {
    renderPayments();
    const links = await screen.findAllByRole('link', { name: 'Open case' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/accounts/case?property=');
    }
  });
});
