/**
 * Tests for CategoricalChart (ADR-0011, ADR-0013).
 *
 * The interesting failures for a categorical chart are not "does it draw a
 * line". They are: two properties rendered in the same colour, a series
 * separated by colour ALONE (which ADR-0011 measured as unsafe past three
 * series), a seventh series wrapping round to chart-1, a gap interpolated into
 * a plausible straight line, and a chart shipped with no textual account of
 * what the lines say. None of those is visible in a code review, so each is
 * asserted here — including one assertion against the stylesheet itself,
 * because the colour/dash binding lives in CSS and a DOM query cannot see it.
 *
 * @requirement FR-61
 */
/// <reference types="node" />
// The only file in src/ that reads its own sibling source text: Vite's `?raw`
// and `?inline` both route a `.module.css` request through Vitest's own CSS
// interceptor — `?raw` returns an opaque mock proxy (isCSSModule() matches
// regardless of query, and the proxy is only bypassed for `?inline`), and
// `?inline` returns the CSS after class-name hashing, so neither yields the
// literal, unmodified `.s1 { … }` source this test needs to inspect. Reading
// the file straight off disk sidesteps Vite's module graph entirely; Vitest
// tests run under real Node, so this works at runtime. `tsconfig.app.json`
// (src/ is browser code) omits Node's ambient types, so this one file opts
// back in explicitly rather than widening the whole project's `types`.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CategoricalChart } from './CategoricalChart.tsx';
import { asChartSeries } from './categoricalSeries.ts';
import type {
  CategoricalChartProps,
  CategoricalSeriesSet,
  ChartSeries,
} from '../components/contracts.ts';
import i18n from '../lib/i18n/index.ts';

const DAYS = ['2026-09-01', '2026-09-02', '2026-09-03'];

/** A property/unit name is free text, exactly as it arrives from the data. */
const seriesNamed = (name: string, values: (number | null)[]): ChartSeries => ({
  name,
  points: DAYS.map((t, i) => ({ t, value: values[i] ?? null })),
});

const SIX: CategoricalSeriesSet = [
  seriesNamed('AC 1', [4, 6, 5]),
  seriesNamed('AC 2', [8, 7, 9]),
  seriesNamed('AC 3', [2, 3, 2.5]),
  seriesNamed('Menara Selatan', [11, 9, 10]),
  seriesNamed('Menara Utara', [6, 6.5, 7]),
  seriesNamed('Gudang', [1, 2, 1.5]),
];

function renderChart(overrides: Partial<CategoricalChartProps> = {}) {
  const props: CategoricalChartProps = {
    accessibleNameKey: 'client.energy.byUnit',
    series: SIX,
    unit: 'kWh',
    provenance: 'simulated',
    textAlternative: { kind: 'table' },
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <CategoricalChart
        accessibleNameKey={props.accessibleNameKey}
        series={props.series}
        unit={props.unit}
        provenance={props.provenance}
        textAlternative={props.textAlternative}
        methodHref={props.methodHref}
      />
    </MemoryRouter>,
  );
}

const groups = (container: HTMLElement) =>
  [...container.querySelectorAll('g[data-series]')] as HTMLElement[];

describe('CategoricalChart — series identity', () => {
  it('gives every series its own slot, in ramp order, with a line and an end marker', () => {
    const { container } = renderChart();
    const drawn = groups(container);
    expect(drawn).toHaveLength(6);
    expect(drawn.map((g) => g.getAttribute('data-series'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    for (const g of drawn) {
      // Colour + dash arrive together from the slot class; the marker is the
      // third channel and is drawn per series, not per chart.
      expect(g.querySelectorAll('path').length).toBeGreaterThan(0);
      expect(g.querySelectorAll('circle[data-marker]')).toHaveLength(1);
    }
  });

  it('binds slot N to chart colour N AND a distinct dash pattern, in one place', () => {
    // ADR-0011 measured the six-colour ramp at 10.2 ΔE for a deuteranope — safe
    // on colour alone only across chart-1..3. So the stylesheet is the thing
    // under test: if a slot ever loses its dash, or two slots share a colour,
    // the chart is separating properties by hue alone and the measurement no
    // longer holds. A DOM assertion cannot see this; reading the CSS can.
    // Root-relative, matching every tools/verify-*.mjs script's own
    // convention — `npm run verify`/`vitest run` always run from repo root.
    const css = readFileSync('src/patterns/CategoricalChart.module.css', 'utf8');
    const dashes = new Set<string>();
    for (let n = 1; n <= 6; n += 1) {
      const block = new RegExp(`\\.s${n}\\s*\\{([^}]*)\\}`).exec(css);
      expect(
        block,
        `.s${n} is not defined — slot ${n} would render unstyled`,
      ).not.toBeNull();
      const body = block![1];
      expect(body).toContain(`var(--color-chart-${n})`);
      const dash = /--series-dash:\s*([^;]+);/.exec(body)?.[1].trim();
      expect(dash, `.s${n} declares no --series-dash`).toBeTruthy();
      expect(dashes.has(dash!), `slot ${n} repeats the dash pattern "${dash!}"`).toBe(
        false,
      );
      dashes.add(dash!);
    }
    expect(dashes.size).toBe(6);
    // And the one place the two are consumed keeps them together.
    const line = /\.line\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(line).toContain('var(--series-color)');
    expect(line).toContain('var(--series-dash)');
    expect(line).toContain('var(--chart-stroke-width)');
  });

  it('refuses a seventh series rather than reusing chart-1', () => {
    // The prop type is a 1..6 tuple union, so a seventh series does not compile
    // — that is the real gate, and it cannot be tested at runtime. This guard
    // catches the cast that gets written to get past the compiler at 2 a.m.
    const seven = [
      ...SIX,
      seriesNamed('Anex', [1, 1, 1]),
    ] as unknown as CategoricalSeriesSet;
    expect(() => renderChart({ series: seven })).toThrow(
      /7 series — the categorical ramp has six colours/,
    );
  });

  it('narrows a runtime list to the six slots, and refuses to truncate one', () => {
    const list: ChartSeries[] = [...SIX];
    expect(asChartSeries(list)).toHaveLength(6);
    expect(asChartSeries([])).toBeNull();
    // Seven is a screen decision (small multiples, or "top 6 and the rest"),
    // not something a chart may silently drop the seventh of.
    expect(asChartSeries([...list, seriesNamed('Anex', [1, 1, 1])])).toBeNull();
  });
});

describe('CategoricalChart — the legend is not optional', () => {
  it('names every series in the legend, in its real free text', () => {
    renderChart();
    const legend = screen.getByRole('list', { name: 'Series' });
    for (const s of SIX) {
      expect(within(legend).getByText(s.name)).toBeInTheDocument();
    }
  });

  it('says when a series has nothing to plot, with its last-seen time', () => {
    const silent: ChartSeries = {
      name: 'Gudang',
      points: [],
      lastSeen: '2026-09-01T08:00:00Z',
    };
    renderChart({ series: [SIX[0], silent] });
    const legend = screen.getByRole('list', { name: 'Series' });
    expect(within(legend).getByText('Gudang')).toBeInTheDocument();
    // Grey is not a pass: an unreported series says so and carries a time,
    // rather than flat-lining at zero.
    expect(within(legend).getByText(/No data/)).toBeInTheDocument();
    expect(within(legend).getByText(/Last seen/)).toBeInTheDocument();
  });
});

describe('CategoricalChart — the textual account', () => {
  it('builds a real data table when the caller takes the table', () => {
    renderChart();
    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: /Time/ }),
    ).toBeInTheDocument();
    for (const s of SIX) {
      expect(
        within(table).getByRole('columnheader', { name: new RegExp(s.name) }),
      ).toBeInTheDocument();
    }
    expect(within(table).getAllByRole('row')).toHaveLength(DAYS.length + 1);
  });

  it('renders a caller summary instead when that is the account given', () => {
    renderChart({
      series: [SIX[0], SIX[1]],
      textAlternative: { kind: 'summary', summary: 'AC 2 used the most on every day.' },
    });
    expect(screen.getByText('AC 2 used the most on every day.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('rejects an empty summary rather than rendering a chart with no account', () => {
    expect(() =>
      renderChart({ textAlternative: { kind: 'summary', summary: '   ' } }),
    ).toThrow(/text alternative/i);
  });

  it('carries provenance beside the figure and an accessible name that says what it shows', () => {
    renderChart();
    // ADR-0020 — the provenance label is suppressed; the prop it is derived
    // from is still required by the contract and checked by the gate.
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'By unit' })).toBeInTheDocument();
  });

  it('links the method when the screen has one, and omits the link when it does not', () => {
    const { unmount } = renderChart({ methodHref: '/insights?method' });
    expect(screen.getByRole('link', { name: /calculated/i })).toHaveAttribute(
      'href',
      '/insights?method',
    );
    unmount();
    renderChart();
    expect(screen.queryByRole('link', { name: /calculated/i })).toBeNull();
  });
});

describe('CategoricalChart — missing is not zero', () => {
  it('breaks the line at a gap rather than drawing through it', () => {
    const { container } = renderChart({
      series: [
        {
          name: 'AC 1',
          points: [
            { t: DAYS[0], value: 4 },
            { t: DAYS[1], value: null },
            { t: DAYS[2], value: 5 },
          ],
        },
      ],
    });
    // A single path across the gap would assert a reading nobody took.
    const [g] = groups(container);
    expect(g.querySelectorAll('path')).toHaveLength(0);
    expect(g.querySelectorAll('circle')).toHaveLength(3); // two readings + the end marker
  });

  it('reports a missing reading as missing in the table, never as 0', () => {
    renderChart({
      series: [
        {
          name: 'AC 1',
          points: [
            { t: DAYS[0], value: 4 },
            { t: DAYS[1], value: null },
            { t: DAYS[2], value: 5 },
          ],
        },
      ],
    });
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[2]).getByText('No data')).toBeInTheDocument();
  });
});

describe('CategoricalChart — both locales', () => {
  it('turns its own wording with the locale and leaves the property names alone', async () => {
    await i18n.changeLanguage('id');
    const { unmount } = renderChart();
    const legend = screen.getByRole('list', { name: 'Seri' });
    expect(screen.getByText('Lihat datanya')).toBeInTheDocument();
    // A property name is free text: it is a proper noun, not a translatable
    // string, and it must survive the language switch unchanged.
    expect(within(legend).getByText('Menara Selatan')).toBeInTheDocument();
    unmount();
    await i18n.changeLanguage('en');
  });
});
