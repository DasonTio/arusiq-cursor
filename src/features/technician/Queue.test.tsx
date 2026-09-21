import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Queue from './Queue.tsx';

const tech = {
  userId: 'user-tech',
  role: 'technician-internal' as const,
  name: 'Budi Pratama',
};

const partner = {
  userId: 'user-partner',
  role: 'technician-thirdparty' as const,
  name: 'Dewi Lestari',
};

function renderQueue(
  path: string,
  session: {
    userId: string;
    role: 'technician-internal' | 'technician-thirdparty';
    name: string;
  },
) {
  return render(
    <SessionProvider initialSession={session}>
      <MemoryRouter initialEntries={[path]}>
        <Queue />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('Work queue and work order — FR-32 FR-34 FR-11', () => {
  it('lists assigned visits for the internal technician', async () => {
    renderQueue('/work', tech);
    expect(await screen.findByRole('heading', { name: 'Work' })).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.some((link) => link.getAttribute('href')?.includes('order='))).toBe(
      true,
    );
  });

  it('scopes a third-party technician to assigned work only', async () => {
    renderQueue('/work', partner);
    expect(await screen.findByText('Study')).toBeInTheDocument();
    expect(screen.queryByText('Dining')).not.toBeInTheDocument();
  });

  it('summarises critical, today, week and silent counts as a KPI strip', async () => {
    renderQueue('/work', tech);
    await screen.findByRole('heading', { name: 'Work' });
    for (const label of ['Critical', 'Today', 'This week', 'Silent units']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('groups the queue into a single PriorityList, each row carrying a SeverityIndicator', async () => {
    renderQueue('/work', tech);
    const list = await screen.findByRole('group', { name: 'Work' });
    expect(within(list).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(
      0,
    );
  });

  it('refuses a third party the compressor visit', async () => {
    renderQueue('/work?order=WO-2026-0733', partner);
    expect(
      await screen.findByText('That visit is not in your access.'),
    ).toBeInTheDocument();
  });

  it('shows the twelve-part checklist grouped indoor, outdoor, electrical', async () => {
    renderQueue('/work?order=WO-2026-0733&view=checklist', tech);
    expect(await screen.findByText('WO-2026-0733')).toBeInTheDocument();
    expect(screen.getByText('Indoor')).toBeInTheDocument();
    expect(screen.getByText('Outdoor')).toBeInTheDocument();
    expect(screen.getByText('Electrical')).toBeInTheDocument();
    expect(screen.getByText('Compressor')).toBeInTheDocument();
    expect(screen.getByText('Air filter')).toBeInTheDocument();
    // One table per group, each named for what it IS rather than repeating
    // the heading above it — a screen reader should not hear "Indoor" twice.
    expect(screen.getByRole('table', { name: 'Indoor checks' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Outdoor checks' })).toBeInTheDocument();
  });

  it('records a finding and refuses to close over a failed step', async () => {
    const user = userEvent.setup();
    renderQueue('/work?order=WO-2026-0733&view=findings', tech);
    expect(await screen.findByText('Record a finding')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save finding' }));
    expect(
      await screen.findByText('The suspected part was confirmed on site.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Closure' }));
    await user.click(screen.getByRole('button', { name: 'Repaired' }));
    expect(
      await screen.findByText('Record every checklist step before closing.'),
    ).toBeInTheDocument();
  });
});
