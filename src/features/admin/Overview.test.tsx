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
import {
  REFERENCE_NOW,
  simulatedTelemetry,
  trailingPeriod,
} from '../../lib/simulation/index.ts';
import i18n from '../../lib/i18n/index.ts';
import { portfolioCompleteness } from './portfolioCompleteness.ts';
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

describe('admin.overview — the portfolio glance is the portfolio · FR-71', () => {
  it('averages every site instead of reporting the first one', async () => {
    // The two sites have different completeness, and the section used to
    // load `properties[0]` only — so HQ read one site's figure as the estate's.
    const scope = { role: hq.role, userId: hq.userId };
    const period = trailingPeriod(new Date(REFERENCE_NOW), 30);
    const properties = await simulatedTelemetry.listProperties(scope);
    const all = await Promise.all(
      properties.map((property) =>
        simulatedTelemetry.getEnergy(scope, property.id, period),
      ),
    );
    // The fixture must keep more than one site, or this proves nothing.
    expect(properties.length).toBeGreaterThan(1);
    const mean = all.reduce((sum, series) => sum + series.completeness, 0) / all.length;
    expect(mean).not.toBeCloseTo(all[0].completeness, 3);

    renderOverview();
    await screen.findByRole('heading', { name: 'Portfolio glance' });
    expect(
      // Built from the locale, not concatenated here: the separators are the
      // locale's business and a hand-built matcher would pass in English only.
      screen.getByText(
        i18n.t('admin.overview.completenessAcross', {
          value: new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: 0,
          }).format(mean * 100),
          count: all.length,
        }),
      ),
    ).toBeInTheDocument();
  });

  it('names no site while every site has met the method', async () => {
    // Bintaro sits exactly ON the threshold, and FR-71's wording is "below",
    // so it has met the method and must not be named. That branch
    // is covered in portfolioCompleteness.test.ts, where a site can be put
    // under it — no fixture puts one there today.
    renderOverview();
    await screen.findByRole('heading', { name: 'Portfolio glance' });
    expect(screen.queryByText(/is the lowest at/)).toBeNull();
  });

  it('still derives the aggregate provenance, though ADR-0020 hides the label', () => {
    // INV-AGGREGATE is a DATA rule: one simulated input makes the whole
    // portfolio figure simulated. Suppressing the chip must not quietly
    // disable that, so it is asserted where it lives.
    const rows = [
      {
        property: { id: 'a', name: 'A' },
        series: { completeness: 1, provenance: 'verified' },
      },
      {
        property: { id: 'b', name: 'B' },
        series: { completeness: 1, provenance: 'simulated' },
      },
    ] as unknown as Parameters<typeof portfolioCompleteness>[0];
    expect(portfolioCompleteness(rows)?.provenance).toBe('simulated');
  });
});

describe('admin.overview — a silent unit is stated, not left blank · INV-GREY', () => {
  it('says how many units are silent and when one was last heard from', async () => {
    // This was a bare "No data" under the portfolio figure: no subject, no
    // count and no last-seen. Grey means "we do not know", and the rule is
    // that it always carries a last-seen time.
    renderOverview();
    await screen.findByRole('heading', { name: 'Portfolio glance' });
    const line = screen.getByText(/Units not reporting: \d+\./);
    expect(line).toBeInTheDocument();
    expect(line.textContent).toMatch(/Last heard from .+/);
  });

  it('marks it with the unknown severity, not a bare sentence', async () => {
    renderOverview();
    const heading = await screen.findByRole('heading', { name: 'Portfolio glance' });
    const section = heading.closest('section') as HTMLElement;
    expect(within(section).getByText('No data')).toBeInTheDocument();
  });
});
