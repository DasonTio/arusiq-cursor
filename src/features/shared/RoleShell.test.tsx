/// <reference types="node" />
// Reading index.css's own source is the only way to assert the skip link's
// focus reveal exists: it is a clip-path/position rule, and jsdom does not
// run real layout, so a rendered-DOM assertion can't see it. `src/` has no
// Node types in tsconfig.app.json (browser code) — opted back in for this
// file only, same precedent as src/patterns/CategoricalChart.test.tsx.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Role } from '../../lib/domain/role.ts';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import { RoleShell } from './RoleShell.tsx';

beforeEach(() => {
  window.localStorage.clear();
});

function renderShell(role: Role, path: string) {
  return render(
    <SessionProvider initialSession={{ userId: 'u1', role, name: 'Test' }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RoleShell />}>
            <Route path={path} element={<p data-testid="screen" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

/** Both the rail and the tab bar are in the DOM; CSS picks one per breakpoint. */
const railLabels = (): string[] => {
  const [rail] = screen.getAllByRole('navigation', { name: 'Primary' });
  return within(rail)
    .getAllByRole('link')
    .map((link) => {
      return link.textContent ?? '';
    });
};

describe('RoleShell rails — D2 v2.1 · ADR-0008 · ADR-0010', () => {
  it('gives the client five labelled destinations', () => {
    renderShell('client', '/home');
    expect(railLabels()).toEqual(['Home', 'Spaces', 'Alerts', 'Insights', 'Account']);
  });

  it('gives the technician three labelled destinations', () => {
    renderShell('technician-internal', '/work');
    expect(railLabels()).toEqual(['Work', 'Map', 'Me']);
  });

  it('keeps a phone tab bar for the client and technician', () => {
    renderShell('client', '/home');
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(2);
  });

  it('gives HQ one sidebar and no phone tab bar', () => {
    renderShell('admin', '/overview');
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1);
    for (const section of ['Overview', 'Fleet', 'Service', 'Accounts', 'Reporting']) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it('names every destination in words, never an icon alone', () => {
    renderShell('client', '/home');
    for (const label of railLabels()) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps search, assistant, language and profile reachable from every screen', () => {
    renderShell('client', '/home');
    expect(screen.getByRole('link', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });

  it('tells HQ where the work gets finished when a view is read-only on a phone', () => {
    renderShell('admin', '/fleet');
    expect(screen.getByRole('status')).toHaveTextContent(
      'This view is read-only on a phone. Continue on desktop.',
    );
  });

  it('places the brand wordmark in the primary rail (Figma composition · ADR-0010)', () => {
    renderShell('client', '/home');
    const [rail] = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(within(rail).getByText('ARUSIQ')).toBeInTheDocument();
  });

  it('offers sign-out from the rail as an action, not a destination', () => {
    renderShell('technician-internal', '/work');
    expect(railLabels()).toEqual(['Work', 'Map', 'Me']);
    const [rail] = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(within(rail).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('gives every screen a skip link to #main, first in the DOM', () => {
    renderShell('client', '/home');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')).toBeInTheDocument();
    const allLinks = screen.getAllByRole('link');
    expect(allLinks[0]).toBe(skip);
  });

  it('reveals the skip link on focus instead of leaving it permanently clipped', () => {
    // Behavioural half: the DOM position/attributes.
    renderShell('client', '/home');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveClass('sr-only');

    // Visual half: jsdom does not run layout, so clip-path/position can only
    // be asserted by reading the stylesheet source itself.
    const css = readFileSync('src/index.css', 'utf8');
    const focusRule = /\.sr-only:focus[^{]*\{([^}]*)\}/.exec(css)?.[1];
    expect(
      focusRule,
      '.sr-only:focus reveal rule is missing from index.css',
    ).toBeTruthy();
    expect(focusRule).toContain('clip-path: none');
    expect(focusRule).not.toMatch(/inline-size:\s*1px/);
  });
});
