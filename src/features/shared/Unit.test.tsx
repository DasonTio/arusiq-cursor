/**
 * Tests for shared.unit — Now view recomposition (Task D of the 2026-09-19
 * design refactor): a four-card grid (Temperature & Humidity, Controls, Air
 * quality, Energy), header adopting PageHeader with the unit's free-text
 * name, Adjust linking into the control view's command lifecycle.
 *
 * @requirement FR-14 FR-15
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SIMULATED_POLICY } from '../../lib/simulation/index.ts';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Unit from './Unit.tsx';

const household = {
  userId: 'user-client',
  role: 'client' as const,
  name: 'Sari Wijaya',
};

function renderUnit(node: string) {
  return render(
    <SessionProvider initialSession={household}>
      <MemoryRouter initialEntries={[`/unit?node=${node}`]}>
        <Unit />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('shared.unit — Now view · FR-14 FR-15', () => {
  it('titles the page with the unit name via PageHeader', async () => {
    renderUnit('unit-attic-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Attic' }),
    ).toBeInTheDocument();
  });

  it('renders the Now view as four cards', async () => {
    renderUnit('unit-attic-1');
    await screen.findByRole('heading', { level: 1, name: 'Attic' });
    for (const label of [
      'Temperature & Humidity',
      'Controls',
      'Indoor air',
      'Energy',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('links Adjust to the control view, not an inline toggle', async () => {
    renderUnit('unit-attic-1');
    await screen.findByRole('heading', { level: 1, name: 'Attic' });
    const adjust = screen.getByRole('link', { name: 'Adjust' });
    expect(adjust.getAttribute('href')).toContain('view=control');
  });

  it('states an absent CO₂ sensor rather than a fabricated value', async () => {
    renderUnit('unit-kids-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Kids' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Not fitted · Indoor CO₂')).toBeInTheDocument();
  });

  it('sends a technician to their own queue, not the client-only service route, from History', async () => {
    render(
      <SessionProvider
        initialSession={{
          userId: 'user-tech',
          role: 'technician-internal',
          name: 'Budi',
        }}
      >
        <MemoryRouter initialEntries={['/unit?node=unit-attic-1&view=history']}>
          <Unit />
        </MemoryRouter>
      </SessionProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Attic' });
    const request = screen.getByRole('link', { name: 'Request a visit' });
    expect(request.getAttribute('href')).toBe('/work');
  });

  it('sends an admin to the service board, not the client-only service route, from History', async () => {
    render(
      <SessionProvider
        initialSession={{ userId: 'user-admin', role: 'admin', name: 'HQ Ops' }}
      >
        <MemoryRouter initialEntries={['/unit?node=unit-attic-1&view=history']}>
          <Unit />
        </MemoryRouter>
      </SessionProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Attic' });
    const request = screen.getByRole('link', { name: 'Request a visit' });
    expect(request.getAttribute('href')).toBe('/service');
  });

  it('draws each of the twelve parts with its own glyph in the Health view (ADR-0012)', async () => {
    render(
      <SessionProvider initialSession={household}>
        <MemoryRouter initialEntries={['/unit?node=unit-attic-1&view=health']}>
          <Unit />
        </MemoryRouter>
      </SessionProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Twelve monitored parts' }),
    ).toBeInTheDocument();
    // Every part row's identity group carries a decorative <svg> glyph.
    const names = screen.getAllByText('Compressor');
    expect(names.length).toBeGreaterThan(0);
    const row = names[0].closest('li');
    expect(row?.querySelector('svg')).toBeInTheDocument();
  });

  it('marks the active view tab with aria-current, not colour alone (ADR-0014)', async () => {
    renderUnit('unit-attic-1');
    const now = await screen.findByRole('link', { name: 'Now', current: 'page' });
    expect(now).toBeInTheDocument();
    const health = screen.getByRole('link', { name: 'Health' });
    expect(health).not.toHaveAttribute('aria-current');
  });

  it('sends a part with no active alert to the role-appropriate service link, not the client-only route', async () => {
    render(
      <SessionProvider
        initialSession={{
          userId: 'user-tech',
          role: 'technician-internal',
          name: 'Budi',
        }}
      >
        <MemoryRouter initialEntries={['/unit?node=unit-attic-1&view=health']}>
          <Unit />
        </MemoryRouter>
      </SessionProvider>,
    );
    await screen.findByRole('heading', { name: 'Twelve monitored parts' });
    const links = screen.getAllByRole('link', { name: 'Open service history' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/work');
    }
  });
});

describe('shared.unit — command lifecycle · FR-40', () => {
  function renderControl(node: string) {
    return render(
      <SessionProvider initialSession={household}>
        <MemoryRouter initialEntries={[`/unit?node=${node}&view=control`]}>
          <Unit />
        </MemoryRouter>
      </SessionProvider>,
    );
  }

  it('shows the Sent → Acknowledged → Verified progression, marked at the current rung', async () => {
    renderControl('unit-study-1');
    await screen.findByRole('heading', { level: 1, name: 'Study' });
    const progress = screen.getByRole('list', { name: 'Command progress' });
    const items = within(progress).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Sent',
      'Acknowledged',
      'Verified',
    ]);
    // study-1's last command is acknowledged: Sent done, Acknowledged current,
    // Verified still ahead.
    expect(items[0].getAttribute('aria-current')).toBeNull();
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[0].className).toContain('done');
    expect(items[2].className).not.toContain('done');
  });

  it('fails honestly: the deliberate fixture failure says the unit did not move', async () => {
    renderControl('unit-dining-1');
    await screen.findByRole('heading', { level: 1, name: 'Dining' });
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/the unit did not move/i)).toBeInTheDocument();
  });

  it('walks the pipeline after a command is sent, rather than sitting on Sent', async () => {
    // FR-40's point is that the control does NOT flip on tap. The simulator
    // runs on a fixed clock, so the view ticks `advanceCommand` explicitly —
    // fake timers assert that without sleeping on the wall clock.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderControl('unit-study-1');
      await screen.findByRole('list', { name: 'Command progress' });
      const rung = (name: string) =>
        within(screen.getByRole('list', { name: 'Command progress' }))
          .getByText(name)
          .closest('li') as HTMLElement;

      // Make the draft dirty, then confirm — the sheet is deliberate, a
      // control does not move on a single tap.
      await user.click(screen.getByRole('button', { name: 'Eco' }));
      await user.click(screen.getByRole('button', { name: 'Send command' }));
      const confirm = screen.getAllByRole('button', { name: 'Send command' });
      await user.click(confirm[confirm.length - 1]);

      // Issued: on the first rung and not settled.
      expect(rung('Verified').className).not.toContain('done');

      const { acknowledgedAfterMs, verifiedAfterMs } = SIMULATED_POLICY.commandTimings;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(acknowledgedAfterMs + 50);
      });
      expect(rung('Acknowledged').className).toContain('done');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(verifiedAfterMs + 50);
      });
      expect(rung('Verified').className).toContain('done');

      // The other half of FR-40: Verified must SETTLE the control, not just
      // light a rung. Before this was wired, the summary kept showing the
      // pre-command setpoint and the Confirm button came back.
      expect(await screen.findByText(/Eco ·/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Send command' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds a queued command with its time rather than dropping it', async () => {
    renderControl('unit-attic-1');
    await screen.findByRole('heading', { level: 1, name: 'Attic' });
    expect(screen.getByText(/Queued — device unreachable/)).toBeInTheDocument();
    expect(screen.getByText(/held since/i)).toBeInTheDocument();
  });
});
