import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('admin.settings — the published thresholds · FR-27', () => {
  it('publishes the same limits the product evaluates against', () => {
    // The whole point of the screen. A second, display-only table drifted
    // from the catalogue on 17 of 24 rows and an admin had no way to tell.
    renderSettings();
    const compressor = PART_CATALOGUE.find((part) => part.id === 'compressor');
    const current = compressor?.signals.find((signal) => signal.key === 'current');
    expect(current?.threshold).toBe(8.5);
    expect(
      screen.getByText(/Compressor current · alerts above 8\.5 A/),
    ).toBeInTheDocument();
  });

  it('names the direction, because a floor and a ceiling are not the same rule', () => {
    // 198 V is the voltage the supply must stay ABOVE. Printed bare it reads
    // as a ceiling, which inverts the rule on the screen that publishes it.
    renderSettings();
    expect(screen.getByText(/Supply voltage · alerts below 198 V/)).toBeInTheDocument();
    expect(screen.getByText(/Supply airflow · alerts below 380/)).toBeInTheDocument();
  });

  it('lists every monitored part, not a subset someone kept in sync by hand', () => {
    const { container } = renderSettings();
    const thresholds = container.querySelectorAll('li');
    const listed = Array.from(thresholds).map((item) => {
      return item.querySelector('p')?.textContent;
    });
    // All twelve parts, and a line per signal each one declares.
    PART_CATALOGUE.forEach((part) => {
      expect(listed).toContain(i18n.t(`part.${part.id}`));
      part.signals.forEach((signal) => {
        expect(
          screen.getByText(
            new RegExp(`^${i18n.t(`signal.${part.id}.${signal.key}`)} ·`),
          ),
        ).toBeInTheDocument();
      });
    });
  });

  it('shows the thresholds section itself', () => {
    // The "preview only" note rode on the mock banner, which ADR-0020
    // suppresses. The table it wrapped is the thing that matters here.
    renderSettings();
    expect(screen.getByText('Part thresholds')).toBeInTheDocument();
  });
});
