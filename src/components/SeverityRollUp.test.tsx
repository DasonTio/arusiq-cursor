import { beforeAll, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import i18n from '../lib/i18n/index.ts';
import { SeverityRollUp } from './SeverityRollUp.tsx';

/**
 * The locale packs are owned elsewhere, so the key this component needs is
 * supplied here as a test resource. That makes the required pack entry an
 * executable specification rather than a note in a PR description:
 *   severityRollUp.contributing = "{{count}} of {{total}} need attention"
 */
beforeAll(() => {
  i18n.addResourceBundle(
    'en',
    'translation',
    { severityRollUp: { contributing: '{{count}} of {{total}} need attention' } },
    true,
    true,
  );
});

function renderRollUp() {
  return render(
    <MemoryRouter>
      <SeverityRollUp severity="warning" contributing={2} total={14} href="/alerts" />
    </MemoryRouter>,
  );
}

describe('SeverityRollUp — FR-13, FR-20', () => {
  it('is a single link whose name carries severity and the contributing count', () => {
    renderRollUp();
    // Matched on the count rather than the whole name: jsdom computes no
    // layout, so the space a browser inserts between two flex items is absent
    // and the exact name would assert a jsdom artefact rather than the rule.
    // The severity word is asserted separately, on the same element.
    const link = screen.getByRole('link', { name: /2 of 14 need attention/ });
    expect(link).toHaveAttribute('href', '/alerts');
    expect(link).toHaveTextContent('Warning');
  });

  it('reaches the whole treatment with one tab stop', async () => {
    const user = userEvent.setup();
    renderRollUp();
    await user.tab();
    expect(screen.getByRole('link')).toHaveFocus();
  });

  it('renders the severity shape alongside the colour, never a bare dot', () => {
    renderRollUp();
    // SeverityIndicator draws the triangle for `warning`; the label is the
    // third channel and is asserted in the accessible name above.
    expect(document.querySelector('polygon')).not.toBeNull();
  });
});
