import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Maintenance from './Maintenance.tsx';

const household = {
  userId: 'user-client',
  role: 'client' as const,
  name: 'Sari Wijaya',
};

describe('Client service visits — FR-32 FR-33', () => {
  it('lists household visits and opens the shared object read-only', async () => {
    render(
      <SessionProvider initialSession={household}>
        <MemoryRouter initialEntries={['/account/service']}>
          <Maintenance />
        </MemoryRouter>
      </SessionProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Service & visits' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /Repair visit/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBeTruthy();
    }
  });

  it('prefills and submits a simulated request from its alert', async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider initialSession={household}>
        <MemoryRouter
          initialEntries={[
            '/account/service?request=new&alert=alert-unit-dining-1-compressor',
          ]}
        >
          <Maintenance />
        </MemoryRouter>
      </SessionProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Request a service visit' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Compressor current is too high')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit simulated request' }));
    expect(
      screen.getByText('Your simulated request is ready to track.'),
    ).toBeInTheDocument();
  });
});
