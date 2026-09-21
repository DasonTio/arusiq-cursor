import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import i18n from '../../lib/i18n/index.ts';
import { PART_CATALOGUE } from '../../lib/simulation/index.ts';
import Settings from './Settings.tsx';

const hq = { userId: 'user-admin', role: 'admin' as const, name: 'HQ Ops' };

function renderSettings() {
  return render(
    <SessionProvider initialSession={hq}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </SessionProvider>,
  );
}

/** The row a signal's name appears in, as the reader sees it. */
function rowFor(signalLabel: string) {
  const cell = screen.getByText(signalLabel);
  const row = cell.closest('tr');
  if (!row) throw new Error(`"${signalLabel}" is not in a table row`);
  return row;
}

describe('admin.settings — the published thresholds · FR-27', () => {
  it('publishes the same limits the product evaluates against', () => {
    // The whole point of the screen. A second, display-only table drifted
    // from the catalogue on 17 of 24 rows and an admin had no way to tell.
    renderSettings();
    const compressor = PART_CATALOGUE.find((part) => part.id === 'compressor');
    const current = compressor?.signals.find((signal) => signal.key === 'current');
    expect(current?.threshold).toBe(8.5);
    const row = rowFor('Compressor current');
    expect(within(row).getByText('8.5 A')).toBeInTheDocument();
  });

  it('names the direction, because a floor and a ceiling are not the same rule', () => {
    // 198 V is the voltage the supply must stay ABOVE. Printed bare it reads
    // as a ceiling, which inverts the rule on the screen that publishes it.
    renderSettings();
    const voltage = rowFor('Supply voltage');
    expect(within(voltage).getByText('Alerts below')).toBeInTheDocument();
    expect(within(voltage).getByText('198 V')).toBeInTheDocument();

    const airflow = rowFor('Supply airflow');
    expect(within(airflow).getByText('Alerts below')).toBeInTheDocument();

    // And the other direction is genuinely rendered differently.
    const current = rowFor('Compressor current');
    expect(within(current).getByText('Alerts above')).toBeInTheDocument();
  });

  it('lists every monitored part and every signal it declares', () => {
    renderSettings();
    // All twelve parts, and a row per signal each one declares — no subset
    // someone kept in sync by hand.
    PART_CATALOGUE.forEach((part) => {
      part.signals.forEach((signal) => {
        const row = rowFor(i18n.t(`signal.${part.id}.${signal.key}`));
        expect(within(row).getByText(i18n.t(`part.${part.id}`))).toBeInTheDocument();
      });
    });
    const signalCount = PART_CATALOGUE.reduce(
      (total, part) => total + part.signals.length,
      0,
    );
    const thresholds = screen.getByRole('table', { name: 'Part thresholds' });
    // Every signal is one row, plus the header row.
    expect(within(thresholds).getAllByRole('row')).toHaveLength(signalCount + 1);
  });

  it('every cell carries its column name, so the table recomposes below 768', () => {
    // The mobile layout clips the header and prints each cell's column name
    // beside it. A cell without `data-label` renders as a bare value under a
    // heading nobody can see — which is why the table writes the label rather
    // than trusting twelve hand-written columns.
    renderSettings();
    const thresholds = screen.getByRole('table', { name: 'Part thresholds' });
    const body = within(thresholds).getAllByRole('row').slice(1);
    body.forEach((row) => {
      within(row)
        .getAllByRole('cell')
        .forEach((cell) => expect(cell).toHaveAttribute('data-label'));
      within(row)
        .getAllByRole('rowheader')
        .forEach((cell) => expect(cell).toHaveAttribute('data-label'));
    });
  });

  it('publishes the tariff and the grid factor with their source and date', () => {
    renderSettings();
    const published = screen.getByRole('table', { name: 'Published tables' });
    expect(within(published).getByText('PLN R-1/TR 2 200 VA')).toBeInTheDocument();
    expect(within(published).getByText('KESDM Jamali grid 2026')).toBeInTheDocument();
  });
});
