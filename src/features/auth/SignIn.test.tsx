import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SessionProvider } from './SessionProvider.tsx';
import SignIn from './SignIn.tsx';

beforeEach(() => {
  window.localStorage.clear();
});

function renderSignIn(
  initialEntries: (string | { pathname: string; state?: unknown })[] = ['/sign-in'],
) {
  return render(
    <SessionProvider initialSession={null}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/home" element={<p data-testid="landed-home" />} />
          <Route path="/overview" element={<p data-testid="landed-overview" />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('SignIn — FR-01', () => {
  it('lands a household demo account on Home', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Household demo' }));
    expect(screen.getByTestId('landed-home')).toBeInTheDocument();
  });

  it('still honours "from" when it is reachable by the signing-in role', async () => {
    const user = userEvent.setup();
    renderSignIn([{ pathname: '/sign-in', state: { from: '/home' } }]);
    await user.click(screen.getByRole('button', { name: 'Household demo' }));
    expect(screen.getByTestId('landed-home')).toBeInTheDocument();
  });

  it('lands an HQ demo account on Overview, not a stale client "from" path', async () => {
    // Reproduces switching demo accounts: signing out from the client Home
    // leaves a router `from: '/home'` state behind (RequireAuth's redirect),
    // and a *different* role signing in afterward must not inherit a path
    // that belongs to the role that was just signed out.
    const user = userEvent.setup();
    renderSignIn([{ pathname: '/sign-in', state: { from: '/home' } }]);
    await user.click(screen.getByRole('button', { name: 'HQ demo' }));
    expect(screen.getByTestId('landed-overview')).toBeInTheDocument();
  });

  it('uses the same wording for a wrong password', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText('Email or phone'), 'nobody@x.demo');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Those details did not match. Try again.',
    );
  });
});
