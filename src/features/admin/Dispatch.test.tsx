import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SessionProvider } from '../auth/SessionProvider.tsx';
import Dispatch from './Dispatch.tsx';

const admin = {
  userId: 'user-admin',
  role: 'admin' as const,
  name: 'Andi Nugroho',
};

function renderDispatch(path = '/service') {
  return render(
    <SessionProvider initialSession={admin}>
      <MemoryRouter initialEntries={[path]}>
        <Dispatch />
      </MemoryRouter>
    </SessionProvider>,
  );
}

describe('HQ assignment — FR-31 FR-34', () => {
  it('assigns seeded unassigned work through a scoped simulated panel', async () => {
    const user = userEvent.setup();
    renderDispatch('/service?assign=WO-2026-0760');
    expect(
      await screen.findByRole('heading', { name: 'Assign this visit' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Needs an assignee')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Budi Pratama' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirm simulated assignment' }),
    );
    expect(
      screen.getByText('Budi Pratama is assigned in this prototype session.'),
    ).toBeInTheDocument();
  });
});

describe('admin.dispatch — board · FR-31 FR-32', () => {
  it('titles the board via PageHeader', async () => {
    renderDispatch();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Service board' }),
    ).toBeInTheDocument();
  });

  it('groups visits by state in one PriorityList', async () => {
    renderDispatch();
    const list = await screen.findByRole('group', { name: 'Service board' });
    expect(within(list).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(
      0,
    );
  });

  it('routes an unassigned visit straight into the assign panel, not the work order', async () => {
    renderDispatch();
    const list = await screen.findByRole('group', { name: 'Service board' });
    const links = within(list).getAllByRole('link');
    const assignLink = links.find(
      (link) => link.getAttribute('href') === '/service?assign=WO-2026-0760',
    );
    expect(assignLink).toBeDefined();
  });

  it('routes an assigned visit to the work order', async () => {
    renderDispatch();
    const list = await screen.findByRole('group', { name: 'Service board' });
    const links = within(list).getAllByRole('link');
    const orderLinks = links.filter((link) =>
      link.getAttribute('href')?.startsWith('/service?order='),
    );
    expect(orderLinks.length).toBeGreaterThan(0);
  });
});
