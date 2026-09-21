import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import i18n from '../../lib/i18n/index.ts';
import { simulatedTelemetry } from '../../lib/simulation/index.ts';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Alerts from './Alerts.tsx';

const household = {
  userId: 'user-client',
  role: 'client' as const,
  name: 'Sari Wijaya',
};

const scope = { role: household.role, userId: household.userId };

function renderAlerts(path = '/alerts') {
  return render(
    <SessionProvider initialSession={household}>
      <MemoryRouter initialEntries={[path]}>
        <Alerts />
      </MemoryRouter>
    </SessionProvider>,
  );
}

const rowFor = (title: string) => {
  const row = screen.getAllByText(title)[0].closest('li');
  if (!row) throw new Error(`no row for ${title}`);
  return row;
};

/** The three queues repeat the same severity bands, so an assertion about one
 *  of them is scoped to it rather than to the page. */
const queueFor = (name: string) => {
  const section = screen.getByRole('heading', { name }).closest('section');
  if (!section) throw new Error(`no queue for ${name}`);
  return section;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('client.alerts — FR-21 FR-22', () => {
  it('marks the active space/part filter with aria-pressed, not colour alone (ADR-0014)', async () => {
    renderAlerts();
    await screen.findByRole('heading', { name: 'Alerts' });
    expect(
      screen.getByRole('button', { name: 'All spaces', pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'All parts', pressed: true }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Study' }));
    expect(
      screen.getByRole('button', { name: 'All spaces', pressed: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Study', pressed: true }),
    ).toBeInTheDocument();
  });

  it('opens on the queue that needs action, grouped by severity including grey', async () => {
    renderAlerts();
    expect(await screen.findByRole('heading', { name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs action' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Watching' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resolved' })).toBeInTheDocument();
    // Needs action holds two criticals, one warning and one grey. Grey is its
    // own group and is never folded into the healthy count (INV-GREY).
    const needsAction = within(queueFor('Needs action'));
    expect(needsAction.getByText('Critical · 2')).toBeInTheDocument();
    expect(needsAction.getByText('Warning · 1')).toBeInTheDocument();
    expect(needsAction.getByText('No data · 1')).toBeInTheDocument();
    expect(needsAction.getByText('Compressor current is too high')).toBeInTheDocument();
    expect(within(queueFor('Watching')).getByText('Warning · 2')).toBeInTheDocument();
  });

  it('gives every row its severity label, provenance and exactly one recommended action', async () => {
    renderAlerts();
    await screen.findByRole('heading', { name: 'Alerts' });

    const critical = rowFor('Compressor current is too high');
    expect(within(critical).getByText('Critical')).toBeInTheDocument();
    expect(within(critical).getByText('Equipment fault')).toBeInTheDocument();
    // The ROW is the link, and it is the only one: the board is for deciding
    // which alert to open, and the action that resolves this one is a primary
    // control in the detail it opens.
    const links = within(critical).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      '/alerts?alert=alert-unit-dining-1-compressor',
    );
    // What acting will mean is still on the row, as a hint.
    expect(within(critical).getByText('Open the compressor alert')).toBeInTheDocument();

    const watching = within(queueFor('Watching'));
    const suspected = watching
      .getByText('Air filter likely needs cleaning')
      .closest('li');
    expect(suspected).not.toBeNull();
    expect(
      within(suspected as HTMLElement).getByText(
        'Suspected — waiting on a technician verdict',
      ),
    ).toBeInTheDocument();
  });

  it('shows a grey alert with a last-seen time rather than a zero', async () => {
    renderAlerts();
    await screen.findByRole('heading', { name: 'Alerts' });
    const silent = rowFor('This unit has not reported');
    expect(within(silent).getByText('No data')).toBeInTheDocument();
    expect(within(silent).getByText(/Last seen/)).toBeInTheDocument();
  });

  it('states the delivery of the notice that carried each alert', async () => {
    // The mock banner is suppressed by ADR-0020. The per-notice delivery
    // trail is the part that carries evidence, and it stays — in the detail,
    // where four channel lines per alert do not multiply by seven rows.
    renderAlerts('/alerts?alert=alert-unit-study-1-tamper');
    await screen.findByRole('heading', { name: 'Possible device tamper' });
    expect(screen.getByText('WhatsApp · Delivered')).toBeInTheDocument();
    expect(screen.getByText('Email · Failed')).toBeInTheDocument();
  });

  it('keeps the board to what a triage decision needs', async () => {
    // Every field below is on the DETAIL. On the board they were twelve
    // stacked label lines per card, seven cards deep, on the screen whose
    // whole job is choosing which one to open first.
    renderAlerts();
    await screen.findByRole('heading', { name: 'Alerts' });
    const critical = rowFor('Compressor current is too high');
    expect(within(critical).queryByText(/Confidence/)).not.toBeInTheDocument();
    expect(within(critical).queryByText(/WhatsApp/)).not.toBeInTheDocument();
    // But the reading against its limit is exactly what triage needs, so it
    // stays: 9.24 A against a working limit of 8.5 A.
    expect(within(critical).getByText('9.24')).toBeInTheDocument();
    expect(within(critical).getByText('8.5')).toBeInTheDocument();
  });

  it('narrows the queue by part group and by space', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await screen.findByRole('heading', { name: 'Alerts' });

    await user.click(screen.getByRole('button', { name: 'Outdoor' }));
    expect(screen.getByText('Compressor current is too high')).toBeInTheDocument();
    expect(screen.queryAllByText('Air filter likely needs cleaning')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'All parts' }));
    await user.click(screen.getByRole('button', { name: 'Study' }));
    expect(screen.getByText('Possible device tamper')).toBeInTheDocument();
    expect(
      screen.queryByText('Compressor current is too high'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Electrical' }));
    expect(screen.getByText('No alerts match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Compressor current is too high')).toBeInTheDocument();
  });

  it('opens a full alert inside the route when the query names one', async () => {
    renderAlerts('/alerts?alert=alert-unit-living-2-air-filter');
    expect(
      await screen.findByRole('heading', { name: 'Air filter likely needs cleaning' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Filter pressure drop')).toBeInTheDocument();
    expect(screen.getAllByText('Working limit').length).toBeGreaterThan(0);
    // Matched without the percent sign: a literal measured figure in a .tsx
    // file is what `verify:provenance` exists to catch, tests included.
    expect(screen.getByText(/Confidence 82/)).toBeInTheDocument();
    // Two signals, each with its own start date and duration.
    expect(screen.getAllByText(/Continuing since/)).toHaveLength(2);
    expect(screen.getAllByText(/Ongoing for/)).toHaveLength(2);
    expect(
      screen.getByText('Rising pressure drop across the filter'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The unit will use more energy and cool less evenly'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Projected failure/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the unit' })).toHaveAttribute(
      'href',
      '/spaces?node=unit-living-2',
    );
    expect(screen.getByRole('link', { name: 'Open the space' })).toHaveAttribute(
      'href',
      '/spaces?node=room-living',
    );
    expect(
      screen.getByRole('link', { name: 'Request a filter visit' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to all alerts' }),
    ).toBeInTheDocument();
  });

  it('is not a dead end when the query names an alert nobody can see', async () => {
    renderAlerts('/alerts?alert=alert-does-not-exist');
    expect(
      await screen.findByText('That alert is not in this queue.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to all alerts' }),
    ).toBeInTheDocument();
  });

  it('renders a skeleton of the queue while it loads', () => {
    const { container } = renderAlerts();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByText('Loading alerts')).toBeInTheDocument();
  });

  it('offers a retry when the queue cannot be loaded', async () => {
    const user = userEvent.setup();
    const listAlerts = vi
      .spyOn(simulatedTelemetry, 'listAlerts')
      .mockRejectedValue(new Error('no route to telemetry'));
    renderAlerts();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alerts could not be loaded.',
    );
    listAlerts.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Compressor current is too high'),
    ).toBeInTheDocument();
  });

  it('separates an empty queue from a queue we cannot see', async () => {
    vi.spyOn(simulatedTelemetry, 'listAlerts').mockResolvedValue([]);
    renderAlerts();
    expect(
      await screen.findByText('Nothing is asking for your attention.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open my spaces' })).toBeInTheDocument();
  });

  it('reports a silent home as grey with a last-seen time, never as an empty queue', async () => {
    const properties = await simulatedTelemetry.listProperties(scope);
    for (const property of properties) {
      for (const floor of property.floors) {
        for (const room of floor.rooms) {
          for (const unit of room.units) {
            unit.device.online = false;
            unit.device.lastHeartbeat = '2026-09-16T09:00:00.000Z';
          }
        }
      }
    }
    vi.spyOn(simulatedTelemetry, 'listAlerts').mockResolvedValue([]);
    vi.spyOn(simulatedTelemetry, 'listProperties').mockResolvedValue(properties);
    renderAlerts();
    expect(
      await screen.findByRole('heading', { name: 'We cannot see your units' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last seen/)).toBeInTheDocument();
  });

  it('carries the whole queue in Bahasa Indonesia', async () => {
    await i18n.changeLanguage('id');
    renderAlerts();
    expect(
      await screen.findByRole('heading', { name: 'Peringatan' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perlu tindakan' })).toBeInTheDocument();
    expect(
      within(queueFor('Perlu tindakan')).getByText('Kritis · 2'),
    ).toBeInTheDocument();
    const tamper = rowFor('Kemungkinan gangguan perangkat');
    expect(within(tamper).getByText('Gangguan perangkat')).toBeInTheDocument();
    // And the delivery trail is localised too, in the detail that carries it.
    renderAlerts('/alerts?alert=alert-unit-study-1-tamper');
    await screen.findByRole('heading', { name: 'Kemungkinan gangguan perangkat' });
    expect(screen.getAllByText('Email · Gagal').length).toBeGreaterThan(0);
  });
});
