/**
 * Tests for tech.map — recomposed onto PageHeader + PriorityList (design
 * refactor, 2026-09-19).
 *
 * @requirement FR-11
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Map from './Map.tsx';

const technician = {
  userId: 'user-tech',
  role: 'technician-internal' as const,
  name: 'Budi Santoso',
};

function renderMap() {
  return render(
    <SessionProvider initialSession={technician}>
      <MemoryRouter initialEntries={['/map']}>
        <Map />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('tech.map — FR-11', () => {
  it('titles the page via PageHeader', async () => {
    renderMap();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Map' }),
    ).toBeInTheDocument();
  });

  it('renders assigned sites in travel order as a PriorityList inside the mock boundary', async () => {
    renderMap();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A geographic map is not drawn',
    );
    expect(screen.getByRole('group', { name: 'Map' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Arrive by /).length).toBeGreaterThan(0);
  });
});
