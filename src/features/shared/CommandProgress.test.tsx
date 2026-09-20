/**
 * A queued command is news whether or not it has a timestamp.
 *
 * `terminal === 'queued' && at` gated the whole sentence on the time, so the
 * first command sent to a unit with no prior command — precisely the case
 * where `lastCommand` is absent — rendered a pipeline stuck on "Sent" with
 * nothing saying why. Missing is stated as missing (INV-NO-FABRICATION); it
 * does not delete the news.
 *
 * @requirement FR-40
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Unit from './Unit.tsx';
import { commandStage } from '../../lib/domain/command.ts';
import i18n from '../../lib/i18n/index.ts';

const household = { userId: 'user-client', role: 'client' as const, name: 'Sari' };

describe('command progress — a held command says so · FR-40', () => {
  it('treats queued as a break in the pipeline, not a rung', () => {
    // The domain half of the same rule: queued never advances the control.
    expect(commandStage('queued')).toEqual({ reached: 'sent', terminal: 'queued' });
    expect(commandStage('failed')).toEqual({ reached: 'sent', terminal: 'failed' });
    expect(commandStage('verified')).toEqual({ reached: 'verified', terminal: null });
  });

  it('shows the held command with its time when the record has one', async () => {
    render(
      <SessionProvider initialSession={household}>
        <MemoryRouter initialEntries={['/unit?node=unit-attic-1&view=control']}>
          <Unit />
        </MemoryRouter>
      </SessionProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Attic' });
    // The attic unit is seeded with a queued command that DOES carry a
    // timestamp, so this is the path that always worked. Every seeded queued
    // command has a time, which is why the missing-time case was latent.
    expect(screen.getByText(/Held since .+ the command waits/)).toBeInTheDocument();
  });

  it('states the held command without a time when there is no timestamp', () => {
    // The regression guard for the actual defect: the sentence must exist in
    // a form that needs no time, or the `&& at` gate comes back by the side
    // door of "there is no string to show".
    const withoutTime = i18n.t('shared.unit.commandQueuedNoTime');
    expect(withoutTime).toMatch(/Queued/);
    expect(withoutTime).not.toMatch(/\{\{/);
    expect(i18n.t('shared.unit.commandQueued')).toMatch(/\{\{time\}\}/);
  });
});
