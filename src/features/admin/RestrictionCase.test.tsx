import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import RestrictionCase from './RestrictionCase.tsx';

const hq = { userId: 'user-admin', role: 'admin' as const, name: 'HQ Ops' };

function renderCase(path: string) {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={[path]}>
        <RestrictionCase />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('admin.restriction-case — the whole ladder on one object · FR-52', () => {
  it('opens the case for the worst rung in force on the account, with its approval record', async () => {
    renderCase('/accounts/case?property=prop-bintaro');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Restriction case' }),
    ).toBeInTheDocument();
    // Bintaro's worst rung is the nursery's eco lock (health-sensitive).
    expect(screen.getByText('Rumah Bintaro')).toBeInTheDocument();
    expect(screen.getByText('Eco mode and limited hours')).toBeInTheDocument();
    expect(
      screen.getByText(/Requested by Andi Nugroho, approved by Rina Kusuma/),
    ).toBeInTheDocument();
    // The reason appears in the account summary AND as a payment-notice title.
    expect(screen.getAllByText('An invoice is overdue').length).toBeGreaterThan(0);
  });

  it('disables the stop rung on the object itself when the space is health-sensitive', async () => {
    renderCase('/accounts/case?property=prop-bintaro');
    await screen.findByRole('heading', { level: 1, name: 'Restriction case' });
    expect(
      screen.getByText('Stop is blocked on health-sensitive spaces.'),
    ).toBeInTheDocument();
  });

  it('shows the stop rung unblocked where the space is not health-sensitive', async () => {
    renderCase('/accounts/case?property=prop-scbd');
    await screen.findByRole('heading', { level: 1, name: 'Restriction case' });
    expect(screen.getByText('SCBD Office')).toBeInTheDocument();
    expect(screen.getByText('Service stopped')).toBeInTheDocument();
    expect(
      screen.queryByText('Stop is blocked on health-sensitive spaces.'),
    ).toBeNull();
  });

  it('gives a severity badge only to the rung actually in force', async () => {
    // Bintaro sits on rung 3. Rungs it has passed, and the rung it can never
    // reach, are not "attention now" — a Critical badge on a blocked rung says
    // emergency on the one card that says impossible.
    renderCase('/accounts/case?property=prop-bintaro');
    await screen.findByRole('heading', { level: 1, name: 'Restriction case' });
    const ladder = screen.getByRole('list', { name: 'The ladder in force' });
    const badges = within(ladder).getAllByText(/^(Critical|Warning|Normal|No data)$/);
    expect(badges).toHaveLength(1);
    // And it is the rung in force that carries it, not the blocked stop rung.
    const inForce = within(ladder)
      .getByText('Eco mode and limited hours')
      .closest('li') as HTMLElement;
    expect(within(inForce).getByText('Warning')).toBeInTheDocument();
  });

  it('marks each rung with its state in words, not by colour alone', async () => {
    renderCase('/accounts/case?property=prop-bintaro');
    await screen.findByRole('heading', { level: 1, name: 'Restriction case' });
    const ladder = screen.getByRole('list', { name: 'The ladder in force' });
    expect(within(ladder).getAllByText('Passed').length).toBe(2);
    expect(within(ladder).getByText('In force now')).toBeInTheDocument();
    expect(
      within(ladder).getByText('Stop is blocked on health-sensitive spaces.'),
    ).toBeInTheDocument();
  });

  it('carries the notice history as the evidence and consent record', async () => {
    renderCase('/accounts/case?property=prop-bintaro');
    await screen.findByRole('heading', { level: 1, name: 'Restriction case' });
    expect(
      screen.getByRole('heading', { name: 'Evidence and consent' }),
    ).toBeInTheDocument();
    // The delivery lines are the consent trail — channel and state per notice.
    expect(screen.getAllByText(/In-app ·|WhatsApp ·|Email ·/).length).toBeGreaterThan(
      0,
    );
  });

  it('links back to the accounts it came from', async () => {
    renderCase('/accounts/case?property=prop-bintaro');
    await screen.findByRole('heading', { level: 1, name: 'Restriction case' });
    const back = screen.getByRole('link', { name: 'Back to accounts' });
    expect(back.getAttribute('href')).toBe('/accounts');
  });

  it('states plainly when no property is specified', async () => {
    renderCase('/accounts/case');
    expect(await screen.findByText(/open a case from payments/i)).toBeInTheDocument();
  });
});
