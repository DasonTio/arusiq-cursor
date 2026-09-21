/**
 * BarList — the rules that make a ranking a ranking.
 *
 * @requirement FR-62
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BarList } from './BarList.tsx';

function renderList(items: React.ComponentProps<typeof BarList>['items']) {
  return render(
    <MemoryRouter>
      <BarList
        items={items}
        unit="kWh"
        provenance="simulated"
        accessibleNameKey="client.energy.byUnit"
      />
    </MemoryRouter>,
  );
}

const items = [
  { id: 'a', name: 'Attic', value: 59.33 },
  { id: 'b', name: 'Living Room', value: 360.89 },
  { id: 'c', name: 'Study', value: 87.37 },
];

describe('BarList', () => {
  it('ranks by value, because the order is the answer to "which one"', () => {
    renderList(items);
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent?.split(/\d/)[0].trim())).toEqual([
      'Living Room',
      'Study',
      'Attic',
    ]);
  });

  it('draws every bar against the same length, so two rows are comparable', () => {
    const { container } = renderList(items);
    const widths = [...container.querySelectorAll('[class*="bar"]')].map(
      (bar) => (bar as HTMLElement).style.inlineSize,
    );
    // The largest fills the track; the others are its true fraction.
    expect(Number.parseFloat(widths[0])).toBe(100);
    expect(Number.parseFloat(widths[2])).toBeCloseTo((59.33 / 360.89) * 100, 1);
  });

  it('states a missing reading and draws NO bar — missing is not zero', () => {
    const { container } = renderList([
      { id: 'a', name: 'Attic', value: null },
      { id: 'b', name: 'Living Room', value: 360.89 },
    ]);
    expect(screen.getByText('No data')).toBeInTheDocument();
    // One bar for two rows: an empty track beside a null would read as a
    // measured nothing (INV-NO-FABRICATION).
    expect(container.querySelectorAll('[class*="bar"]')).toHaveLength(1);
    // And it sorts last: it is not a small value, it is an unknown one.
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows[1].textContent).toContain('Attic');
  });

  it('makes the row the link, not a button inside it', () => {
    renderList([{ id: 'a', name: 'Attic', value: 59.33, href: '/spaces?unit=a' }]);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/spaces?unit=a');
    expect(link.textContent).toContain('Attic');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
