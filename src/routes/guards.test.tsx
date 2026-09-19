import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SessionProvider } from '../features/auth/SessionProvider.tsx';
import { RequireRole } from './guards.tsx';

beforeEach(() => {
  window.localStorage.clear();
});

function renderAs(role: 'client' | 'admin') {
  return render(
    <SessionProvider initialSession={{ userId: 'u1', role, name: 'Test' }}>
      <MemoryRouter initialEntries={['/work']}>
        <Routes>
          <Route
            path="/work"
            element={
              <RequireRole allowedRoles={['technician-internal']}>
                <p data-testid="work-ok" />
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('RequireRole — D2 UF-01', () => {
  it('shows not-available instead of an empty foreign page', () => {
    renderAs('client');
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Not available for your role',
    );
    expect(screen.queryByTestId('work-ok')).toBeNull();
  });
});
