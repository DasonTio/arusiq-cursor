/**
 * Tests for admin.overview — HQ "decisions first" recomposition (Task C of
 * the 2026-09-19 design refactor): a KPI strip of four decision counts, then
 * one PriorityList grouping unassigned visits, critical events, overdue
 * accounts and restrictions, portfolio glance last.
 *
 * @requirement FR-12 FR-52
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Overview from './Overview.tsx';

const hq = {
  userId: 'user-admin',
  role: 'admin' as const,
  name: 'HQ Ops',
};

function renderOverview() {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={['/overview']}>
        <Overview />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('admin.overview — FR-12 FR-52', () => {
  it('titles the page "Decisions needed" via PageHeader', async () => {
    renderOverview();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Decisions needed' }),
    ).toBeInTheDocument();
  });

  it('summarises the four decision counts as a KPI strip', async () => {
    renderOverview();
    await screen.findByRole('heading', { level: 1, name: 'Decisions needed' });
    for (const label of [
      'Unassigned visits',
      'Critical events',
      'Overdue accounts',
      'Restrictions in force',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('groups decisions into one PriorityList, each row carrying a SeverityIndicator', async () => {
    renderOverview();
    const list = await screen.findByRole('group', { name: 'Decisions needed' });
    // Assert the groups by name rather than by count: a bare count breaks
    // every time a decision kind is added, which tells you nothing about
    // whether the screen still answers "what needs me today".
    for (const group of [
      'Waiting on a decision',
      'Unassigned visits',
      'Critical events',
      'Overdue accounts',
      'Restrictions in force',
    ]) {
      expect(
        within(list).getByRole('heading', { level: 3, name: group }),
      ).toBeInTheDocument();
    }
  });

  it('puts the restriction approvals that lapse first, and links each into its gate (FR-52)', async () => {
    renderOverview();
    const list = await screen.findByRole('group', { name: 'Decisions needed' });
    const headings = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings[0]).toBe('Waiting on a decision');
    const approvals = within(list).getByRole('heading', {
      level: 3,
      name: 'Waiting on a decision',
    }).parentElement as HTMLElement;
    const hrefs = within(approvals)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs.every((h) => h?.startsWith('/accounts/approve?request='))).toBe(true);
  });

  it('keeps the portfolio glance section last, with a real link out', async () => {
    renderOverview();
    expect(
      await screen.findByRole('heading', { name: 'Portfolio glance' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Energy portfolio' })).toBeInTheDocument();
  });

  it('routes a restriction row into its case, not the generic accounts list (FR-52)', async () => {
    renderOverview();
    const list = await screen.findByRole('group', { name: 'Decisions needed' });
    const restrictions = within(list).getByRole('heading', {
      level: 3,
      name: 'Restrictions in force',
    }).parentElement as HTMLElement;
    const links = within(restrictions)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(links.some((href) => href?.startsWith('/accounts/case?property='))).toBe(
      true,
    );
  });
});
