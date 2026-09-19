/**
 * Tests for MetricGrid and MetricTile. Layout math (column count at each
 * frame) is CSS-only and not asserted under jsdom; these tests pin the
 * composition contract: tiles render, inside one grid container.
 *
 * Fixture text comes from the real locale pack — no user-facing string is
 * hardcoded, even in tests (D5 UR-LANG-01).
 *
 * @requirement FR-10
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../lib/i18n/index.ts';
import { MetricGrid } from './MetricGrid.tsx';
import { MetricTile } from './MetricTile.tsx';

const FIGURE_KEYS = [
  'nav.client.home',
  'nav.client.spaces',
  'nav.client.alerts',
] as const;

describe('MetricGrid', () => {
  it('renders every tile inside a single grid container', () => {
    const { container } = render(
      <MetricGrid>
        {FIGURE_KEYS.map((key) => (
          <MetricTile key={key}>
            <p>{i18n.t(key)}</p>
          </MetricTile>
        ))}
      </MetricGrid>,
    );

    // Each tile is its own card; all of them must be direct children of the
    // one grid root, with no wrapper markup in between.
    const tiles = FIGURE_KEYS.map((key) => screen.getByText(i18n.t(key)).parentElement);
    const grid = tiles[0]?.parentElement ?? null;
    expect(grid).toBe(container.firstChild);
    expect(grid?.children).toHaveLength(3);
    for (const tile of tiles) expect(tile?.parentElement).toBe(grid);
  });
});

describe('MetricTile', () => {
  it('renders its children', () => {
    render(
      <MetricTile>
        <span>{i18n.t('nav.client.insights')}</span>
      </MetricTile>,
    );
    expect(screen.getByText(i18n.t('nav.client.insights'))).toBeInTheDocument();
  });
});
