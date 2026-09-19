/**
 * Tests for tech.me — recomposed onto PageHeader + SectionHeader +
 * PriorityList (design refactor, 2026-09-19).
 *
 * @requirement FR-04 FR-11
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Me from './Me.tsx';

const technician = {
  userId: 'user-tech',
  role: 'technician-internal' as const,
  name: 'Budi Santoso',
};

function renderMe() {
  return render(
    <SessionProvider initialSession={technician}>
      <MemoryRouter initialEntries={['/me']}>
        <Me />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('tech.me — FR-04 FR-11', () => {
  it('titles the page via PageHeader and names the technician', async () => {
    renderMe();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Me' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
  });

  it("groups this week's work into a PriorityList", async () => {
    renderMe();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'This week' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'This week' })).toBeInTheDocument();
  });
});
