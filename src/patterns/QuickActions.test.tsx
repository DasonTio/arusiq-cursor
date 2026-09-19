/**
 * Tests for QuickActions. Locale keys (including the nav label passed as
 * ariaLabelKey) are real pack entries owned elsewhere; this file only
 * borrows them as fixtures.
 *
 * @requirement FR-10
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Bell, Calendar, MapPin, Wrench } from 'lucide-react';
import { QuickActions } from './QuickActions.tsx';
import type { QuickActionItem } from './QuickActions.tsx';

const items: readonly QuickActionItem[] = [
  { id: 'spaces', icon: MapPin, labelKey: 'nav.client.spaces', to: '/spaces' },
  { id: 'alerts', icon: Bell, labelKey: 'nav.client.alerts', to: '/alerts' },
  { id: 'service', icon: Wrench, labelKey: 'nav.client.service' },
  { id: 'account', icon: Calendar, labelKey: 'nav.client.account' },
];

function renderActions(overrides: Partial<QuickActionItem>[] = []) {
  const merged = items.map((item, i) => ({ ...item, ...overrides[i] }));
  return render(
    <MemoryRouter>
      <QuickActions items={merged} ariaLabelKey="shell.search" />
    </MemoryRouter>,
  );
}

describe('QuickActions', () => {
  it('renders one labelled control per item inside the labelled nav', () => {
    renderActions();
    const nav = screen.getByRole('navigation', { name: 'Search' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spaces' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Service & visits' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  it('renders a link when `to` is given', () => {
    renderActions();
    expect(screen.getByRole('link', { name: 'Spaces' })).toHaveAttribute(
      'href',
      '/spaces',
    );
  });

  it('renders a button when only onClick is given', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderActions([{}, {}, { onClick }, {}]);
    const control = screen.getByRole('button', { name: 'Service & visits' });
    await user.click(control);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the caption text visible and the icon aria-hidden — never icon-only', () => {
    renderActions();
    const control = screen.getByRole('link', { name: 'Spaces' });
    // The accessible name comes from the visible caption, not the glyph.
    expect(control).toHaveTextContent('Spaces');
    expect(control.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
