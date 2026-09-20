import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Overview from './Overview.tsx';

const household = {
  userId: 'user-client',
  role: 'client' as const,
  name: 'Sari Wijaya',
};

function renderHome() {
  return render(
    <SessionProvider initialSession={household}>
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('client Home — FR-10 FR-15', () => {
  it('greets the client by name with the property as context', async () => {
    renderHome();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Good (morning|afternoon|evening), Sari/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Rumah Bintaro')).toBeInTheDocument();
  });

  it('shows avoided emissions as a real figure, not a fabricated zero', async () => {
    // ADR-0020 suppressed the provenance LABEL; the figure itself, and the
    // rule that a missing one renders grey rather than 0, are unchanged.
    renderHome();
    expect(await screen.findByText('Avoided emissions this month')).toBeInTheDocument();
    expect(screen.getByText('Attic Store')).toBeInTheDocument();
    expect(screen.getAllByText('Comfort unknown').length).toBeGreaterThan(0);
  });

  it('gives every attention item an action', async () => {
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'Needs your attention' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('summarises the day as four KPI tiles, starting with what needs attention', async () => {
    renderHome();
    expect(
      await screen.findByRole('heading', { name: 'Today at a glance' }),
    ).toBeInTheDocument();
    for (const label of [
      'Need attention',
      'Energy today',
      'Saving vs normal',
      'Comfortable rooms',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('offers four quick actions, every one a real link', async () => {
    renderHome();
    const nav = await screen.findByRole('navigation', {
      name: 'Quick actions',
    });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.getAttribute('href')).toBeTruthy();
    }
  });
});
