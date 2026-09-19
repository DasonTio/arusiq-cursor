/**
 * Tests for shared.approve (P-APPROVE) — the gate on the restriction ladder.
 *
 * The interesting cases are not "does it render a form". They are: can a
 * health-sensitive `stop` be approved from the UI (it must not be), is the
 * health-sensitive check visible BEFORE the buttons, and does a refused
 * request stay answerable rather than becoming a dead end in the queue.
 *
 * @requirement FR-52
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Approve from './Approve.tsx';

const hq = { userId: 'user-admin', role: 'admin' as const, name: 'HQ Ops' };

/** Seeded by the simulator: the nursery is designated health-sensitive and has
 *  a pending request to stop service, which policy must refuse. */
const NURSERY_STOP = 'rq-2026-0036';
/** A rung-2 ask with nothing blocking it. */
const APPROVABLE = 'rq-2026-0031';

function renderApprove(path: string) {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={[path]}>
        <Approve />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('shared.approve — the queue', () => {
  it('lists what is waiting on a decision, each row opening its own request', async () => {
    renderApprove('/accounts/approve');
    const list = await screen.findByRole('group', { name: 'Waiting on a decision' });
    const links = within(list).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/accounts/approve?request=');
    }
  });
});

describe('shared.approve — one request · FR-52', () => {
  it('shows the ask, the evidence and who asked, before any button', async () => {
    renderApprove(`/accounts/approve?request=${APPROVABLE}`);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Approve a restriction step',
    });
    expect(
      screen.getByRole('heading', { name: 'What is being asked' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evidence' })).toBeInTheDocument();
    expect(screen.getByText(/Requested by/)).toBeInTheDocument();
    // A queue with no expiry is a backlog — the lapse time is on the request.
    expect(screen.getByText(/Lapses if undecided by/)).toBeInTheDocument();
  });

  it('always shows the health-sensitive check, even when nothing is designated', async () => {
    renderApprove(`/accounts/approve?request=${APPROVABLE}`);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Approve a restriction step',
    });
    expect(
      screen.getByRole('heading', { name: 'Health-sensitive check' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No space on this request is designated health-sensitive.'),
    ).toBeInTheDocument();
  });

  it('offers approval on a permitted rung', async () => {
    renderApprove(`/accounts/approve?request=${APPROVABLE}`);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Approve a restriction step',
    });
    expect(
      screen.getByRole('button', { name: 'Approve this step' }),
    ).toBeInTheDocument();
  });
});

describe('shared.approve — the safety guarantee · FR-53', () => {
  it('does not offer approval for a stop on a health-sensitive space', async () => {
    renderApprove(`/accounts/approve?request=${NURSERY_STOP}`);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Approve a restriction step',
    });
    expect(
      screen.getByRole('heading', { name: 'This step cannot be approved' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cooling cannot be stopped in a health-sensitive space/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve this step' })).toBeNull();
  });

  it('shows the designation record behind the block, not just the block', async () => {
    renderApprove(`/accounts/approve?request=${NURSERY_STOP}`);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Approve a restriction step',
    });
    expect(
      screen.getByText('This space is designated health-sensitive.'),
    ).toBeInTheDocument();
    // Requester, approver and review date — the record ADR-0015 OD-01 decided.
    expect(screen.getByText(/Approved by/)).toBeInTheDocument();
    expect(screen.getByText(/Due for review/)).toBeInTheDocument();
  });

  it('still lets an approver decline it, so a blocked request is not a dead end', async () => {
    const user = userEvent.setup();
    renderApprove(`/accounts/approve?request=${NURSERY_STOP}`);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Approve a restriction step',
    });
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(
      await screen.findByRole('heading', { name: 'Decision record' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Declined by/)).toBeInTheDocument();
  });
});
