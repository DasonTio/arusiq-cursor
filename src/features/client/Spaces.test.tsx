import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Spaces from './Spaces.tsx';

const household = {
  userId: 'user-client',
  role: 'client' as const,
  name: 'Sari Wijaya',
};

function renderSpaces(path: string) {
  return render(
    <SessionProvider initialSession={household}>
      <MemoryRouter initialEntries={[path]}>
        <Spaces />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('Spaces and unit detail — FR-13 FR-14 FR-15 FR-20', () => {
  it('rolls the home property up from its units', async () => {
    renderSpaces('/spaces');
    expect(await screen.findByRole('heading', { name: 'Spaces' })).toBeInTheDocument();
    expect(screen.getByText('Rumah Bintaro')).toBeInTheDocument();
    expect(screen.getByText('Attic Store')).toBeInTheDocument();
  });

  it('shows grey last-seen values on an offline unit, never a fabricated zero', async () => {
    renderSpaces('/spaces?node=unit-attic-1');
    expect(await screen.findByRole('heading', { name: 'Attic' })).toBeInTheDocument();
    expect(screen.getByText('Not reporting')).toBeInTheDocument();
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Last seen/).length).toBeGreaterThan(0);
  });

  it('classifies the twelve parts and lands the filter journey on Health', async () => {
    const user = userEvent.setup();
    renderSpaces('/spaces?node=unit-living-2&view=health');
    expect(
      await screen.findByRole('heading', { name: 'Living Room B' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Air filter')).toBeInTheDocument();
    expect(screen.getByText('Indoor')).toBeInTheDocument();
    expect(screen.getByText('Outdoor')).toBeInTheDocument();
    expect(screen.getByText('Electrical')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Request a filter visit' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Now' }));
    expect(screen.getByText('Indoor air')).toBeInTheDocument();
  });

  it('opens a room as the shared space object without mixing in emissions', async () => {
    renderSpaces('/spaces?node=room-living');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Living Room' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Comfort')).toBeInTheDocument();
    expect(screen.getByText('Indoor CO₂')).toBeInTheDocument();
    expect(screen.getByText('PM2.5')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Units serving this space' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Units serving this space' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/kgCO₂e/)).not.toBeInTheDocument();
  });
});
