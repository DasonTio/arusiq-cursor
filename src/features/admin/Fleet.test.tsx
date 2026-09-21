/**
 * Tests for admin.fleet — PageHeader adoption on the tree root (design
 * refactor, continued). The tree itself (Property→Floor→Room→Unit) is a
 * genuine hierarchy, left as its own branch markup — not a PriorityList.
 *
 * @requirement FR-12 FR-13
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Fleet from './Fleet.tsx';

const hq = { userId: 'user-admin', role: 'admin' as const, name: 'HQ Ops' };

function renderFleet() {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={['/fleet']}>
        <Fleet />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('admin.fleet — FR-12 FR-13', () => {
  it('titles the tree root via PageHeader', async () => {
    renderFleet();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fleet' }),
    ).toBeInTheDocument();
  });
});

describe('admin.fleet — Activity, the command log · FR-40', () => {
  it('lists per-unit command results, clickable through to the unit', async () => {
    renderFleet();
    const activity = await screen.findByRole('region', { name: 'Recent commands' });
    // The fixture set carries one deliberate failure (dining) and one verified
    // command (living) — both must appear as results, not vanish.
    expect(within(activity).getByText('Failed')).toBeInTheDocument();
    expect(within(activity).getByText('Verified')).toBeInTheDocument();
    const dining = within(activity).getByRole('link', { name: /Dining/ });
    expect(dining.getAttribute('href')).toBe('/fleet?node=unit-dining-1');
  });

  it('renders the log as one chronology table, not a grid of two-fact cards', async () => {
    renderFleet();
    const activity = await screen.findByRole('region', { name: 'Recent commands' });
    const table = within(activity).getByRole('table');
    for (const column of ['When', 'Unit', 'State']) {
      expect(
        within(table).getByRole('columnheader', { name: column }),
      ).toBeInTheDocument();
    }
    // Newest first: the log's meaning is its order.
    const times = within(table)
      .getAllByRole('rowheader')
      .map((cell) =>
        Date.parse(cell.querySelector('time')?.getAttribute('datetime') ?? ''),
      );
    expect(times.length).toBeGreaterThan(1);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});
