/**
 * Tests for PageHeader. Locale keys are real pack entries (owned elsewhere);
 * this file only borrows them as fixtures.
 *
 * @requirement FR-10 FR-15
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../lib/i18n/index.ts';
import { PageHeader } from './PageHeader.tsx';

describe('PageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<PageHeader titleKey="nav.client.home" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
  });

  it('interpolates titleValues into the title', () => {
    render(
      <PageHeader
        titleKey="client.overview.energyTodayCoverage"
        titleValues={{ reporting: 3, total: 4 }}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: '3 of 4 units reported today' }),
    ).toBeInTheDocument();
  });

  it('renders the context line when contextKey is given', () => {
    render(
      <PageHeader titleKey="nav.client.home" contextKey="client.overview.purpose" />,
    );
    expect(
      screen.getByText('Comfort, cost and anything that needs you now.'),
    ).toBeInTheDocument();
  });

  it('renders a data context line when context is given', () => {
    render(<PageHeader titleKey="nav.client.home" context="Rumah Bintaro" />);
    expect(screen.getByText('Rumah Bintaro')).toBeInTheDocument();
  });

  it('renders children in the trailing slot', () => {
    render(
      <PageHeader titleKey="nav.client.home">
        <button type="button">{i18n.t('shell.search')}</button>
      </PageHeader>,
    );
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders a free-text title in place of titleKey (a unit or property name)', () => {
    // i18n-exempt: fixture is a free-text unit name, not UI copy — same as the context="Rumah Bintaro" fixture above.
    render(<PageHeader title="Attic" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Attic' }),
    ).toBeInTheDocument();
  });

  it('omits the context line when contextKey is absent', () => {
    render(<PageHeader titleKey="nav.client.home" />);
    expect(
      screen.queryByText('Comfort, cost and anything that needs you now.'),
    ).not.toBeInTheDocument();
  });
});
