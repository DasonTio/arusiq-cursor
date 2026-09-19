/**
 * Tests for shared.work-order — Brief view recomposition (Task E of the
 * 2026-09-19 design refactor): suspected-fault card with a confidence
 * progress bar, start-this-job card gated on canEdit, device & data state
 * card. Other views are untouched.
 *
 * @requirement FR-25 FR-32
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import WorkOrder from './WorkOrder.tsx';

const technician = {
  userId: 'user-tech',
  role: 'technician-internal' as const,
  name: 'Budi Santoso',
};

function renderBrief(order = 'WO-2026-0733') {
  return render(
    <SessionProvider initialSession={technician}>
      <MemoryRouter initialEntries={[`/work?order=${order}`]}>
        <WorkOrder />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('shared.work-order — Brief view · FR-25 FR-32', () => {
  it('titles the page via PageHeader', async () => {
    renderBrief();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the suspected-fault card with a confidence progress bar', async () => {
    renderBrief();
    expect(
      await screen.findByRole('heading', { name: 'Suspected fault' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('links the start action into the checklist view, gated on canEdit', async () => {
    renderBrief();
    await screen.findByRole('heading', { name: 'Suspected fault' });
    const start = screen.getByRole('link', { name: 'Start the checklist' });
    expect(start.getAttribute('href')).toContain('view=checklist');
  });

  it('shows the device reporting state', async () => {
    renderBrief();
    await screen.findByRole('heading', { name: 'Device & data state' });
    expect(screen.getByText('Reporting now')).toBeInTheDocument();
  });

  it('omits the alert link for a technician rather than sending them to a client-only route', async () => {
    renderBrief();
    await screen.findByRole('heading', { name: 'Suspected fault' });
    expect(
      screen.queryByRole('link', { name: 'Open the alert' }),
    ).not.toBeInTheDocument();
  });

  it('links admin to the real alert-detail route, not the client-only one', async () => {
    render(
      <SessionProvider
        initialSession={{ userId: 'user-admin', role: 'admin', name: 'HQ Ops' }}
      >
        <MemoryRouter initialEntries={['/service?order=WO-2026-0733']}>
          <WorkOrder />
        </MemoryRouter>
      </SessionProvider>,
    );
    await screen.findByRole('heading', { name: 'Suspected fault' });
    const link = screen.getByRole('link', { name: 'Open the alert' });
    expect(link.getAttribute('href')).toBe(
      '/overview/events?alert=alert-unit-dining-1-compressor',
    );
  });
});
