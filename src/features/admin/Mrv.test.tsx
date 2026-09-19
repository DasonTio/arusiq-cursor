/**
 * Tests for admin.mrv's dual-approval announcements (a11y finding B3): the
 * gate must not be a silent colour change — each approval step is a
 * `role="status"` live region, matching shared/Pay.tsx and shared/Assign.tsx.
 *
 * @requirement FR-70 FR-71 FR-73 FR-74
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Mrv from './Mrv.tsx';

const hq = {
  userId: 'user-admin',
  role: 'admin' as const,
  name: 'HQ Ops',
};

function renderMrv() {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={['/reporting/packages']}>
        <Mrv />
      </MemoryRouter>
    </SessionProvider>,
  );
}

/** MockBoundary's own banner is also role="status", so scope to the one
 *  carrying the given text rather than assuming there is only one. */
const statusWithText = (text: string) =>
  screen.getAllByRole('status').find((el) => el.textContent === text);

describe('admin.mrv dual approval — FR-70 FR-71 FR-73 FR-74', () => {
  it('announces the first approval as a status region, not a silent colour change', async () => {
    const user = userEvent.setup();
    renderMrv();
    await user.click(
      await screen.findByRole('button', { name: 'Approve an export (mock)' }),
    );
    expect(
      statusWithText('First approval recorded. A second approver can now confirm.'),
    ).toBeInTheDocument();
  });

  it('enables the second approval only after the first', async () => {
    renderMrv();
    const second = await screen.findByRole('button', {
      name: 'Second approver (mock)',
    });
    expect(second).toBeDisabled();
  });

  it('announces the export confirmation as a status region and replaces the first-approval status', async () => {
    const user = userEvent.setup();
    renderMrv();
    await user.click(
      await screen.findByRole('button', { name: 'Approve an export (mock)' }),
    );
    await user.click(screen.getByRole('button', { name: 'Second approver (mock)' }));
    expect(statusWithText('Nothing was sent to a registry.')).toBeInTheDocument();
    expect(
      statusWithText('First approval recorded. A second approver can now confirm.'),
    ).toBeUndefined();
  });
});
