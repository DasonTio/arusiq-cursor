/**
 * Tests for SectionHeader. Locale keys are real pack entries (owned
 * elsewhere); this file only borrows them as fixtures.
 *
 * @requirement FR-10 FR-15
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../lib/i18n/index.ts';
import { SectionHeader } from './SectionHeader.tsx';

describe('SectionHeader', () => {
  it('renders the title as a level-2 heading', () => {
    render(<SectionHeader titleKey="client.overview.summaryTitle" />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Today at a glance' }),
    ).toBeInTheDocument();
  });

  it('renders trailing children beside the title', () => {
    render(
      <SectionHeader titleKey="client.overview.summaryTitle">
        <a href="/all">{i18n.t('nav.client.account')}</a>
      </SectionHeader>,
    );
    expect(screen.getByRole('link', { name: 'Account' })).toBeInTheDocument();
  });

  it('renders no trailing slot when children are absent', () => {
    const { container } = render(
      <SectionHeader titleKey="client.overview.summaryTitle" />,
    );
    expect(container.firstChild?.childNodes).toHaveLength(1);
  });
});
