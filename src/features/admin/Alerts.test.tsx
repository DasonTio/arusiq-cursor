/**
 * Tests for admin.alerts — recomposed onto PriorityList, grouped by severity
 * (design refactor, continued). The detail view (opened via ?alert=) is
 * untouched.
 *
 * @requirement FR-21 FR-22
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Alerts from './Alerts.tsx';

const hq = { userId: 'user-admin', role: 'admin' as const, name: 'HQ Ops' };

function renderAlerts(path = '/overview/events') {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter initialEntries={[path]}>
        <Alerts />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('admin.alerts — FR-21 FR-22', () => {
  it('titles the queue via PageHeader', async () => {
    renderAlerts();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Events' }),
    ).toBeInTheDocument();
  });

  it('groups alerts by severity in one PriorityList, each row a link into the detail view', async () => {
    renderAlerts();
    const list = await screen.findByRole('group', { name: 'Events' });
    const links = within(list).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/overview/events?alert=');
    }
  });

  it('sends HQ somewhere HQ can actually go (INV-NO-DEAD-END)', async () => {
    // `recommendedAction.href` is authored for the client — /account/service,
    // /account and /spaces are all `allowedRoles: ['client']`. Rendered raw,
    // every row on this queue dead-ended on "not available for your role".
    const clientOnly = ['/account', '/account/service', '/spaces'];
    const list = await (renderAlerts(), screen.findByRole('group', { name: 'Events' }));
    const hrefs = within(list)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href')!);

    for (const href of hrefs) {
      const alertId = new URLSearchParams(href.split('?')[1]).get('alert');
      const view = renderAlerts(`/overview/events?alert=${alertId}`);
      const action = await screen.findAllByRole('link');
      for (const link of action) {
        const target = (link.getAttribute('href') ?? '').split('?')[0];
        expect(clientOnly).not.toContain(target);
      }
      view.unmount();
    }
  });

  it('keeps the detail view reachable and unchanged', async () => {
    renderAlerts();
    const list = await screen.findByRole('group', { name: 'Events' });
    const [firstLink] = within(list).getAllByRole('link');
    const href = firstLink.getAttribute('href')!;
    const alertId = new URLSearchParams(href.split('?')[1]).get('alert');
    renderAlerts(`/overview/events?alert=${alertId}`);
    expect(await screen.findAllByRole('heading', { level: 1 })).not.toHaveLength(0);
  });
});
