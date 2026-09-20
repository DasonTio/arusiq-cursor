/**
 * Tests for PriorityList. Locale keys (including the group label values and
 * the ariaLabelKey) are real pack entries owned elsewhere; this file only
 * borrows them as fixtures.
 *
 * @requirement FR-12 FR-25
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PriorityList } from './PriorityList.tsx';
import type { PriorityGroup } from './PriorityList.tsx';

const groups: readonly PriorityGroup[] = [
  {
    id: 'overdue',
    labelKey: 'client.alerts.severityGroup',
    labelValues: { severity: 'Overdue', count: 2 },
    items: [
      {
        id: 'j1',
        titleKey: 'maintenance.filterService.title',
        severity: 'critical',
        statusKey: 'client.billing.state.overdue',
        to: '/work/j1',
      },
      {
        id: 'j2',
        titleKey: 'maintenance.repair.title',
        detailKey: 'workOrder.origin.prediction',
        severity: 'warning',
        to: '/work/j2',
      },
    ],
  },
  {
    id: 'today',
    labelKey: 'tech.queue.today',
    items: [
      {
        id: 'j3',
        titleKey: 'maintenance.preventiveVisit.title',
        severity: 'normal',
      },
    ],
  },
];

function renderList() {
  return render(
    <MemoryRouter>
      <PriorityList groups={groups} ariaLabelKey="shell.search" />
    </MemoryRouter>,
  );
}

describe('PriorityList', () => {
  it('wraps the queue in a group labelled via ariaLabelKey', () => {
    renderList();
    expect(screen.getByRole('group', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders each group label as a level-3 heading, count interpolated', () => {
    renderList();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Overdue · 2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Today' }),
    ).toBeInTheDocument();
  });

  it('renders every item title', () => {
    renderList();
    expect(screen.getByText('Filter service')).toBeInTheDocument();
    expect(screen.getByText('Repair visit')).toBeInTheDocument();
    expect(screen.getByText('Preventive visit')).toBeInTheDocument();
  });

  it('renders a SeverityIndicator (colour + shape + label) on every row — never a bare rail', () => {
    renderList();
    // The label is the third severity channel; one per row, matching each
    // row's declared severity.
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('renders the detail line when detailKey is given', () => {
    renderList();
    expect(screen.getByText('Raised from a prediction')).toBeInTheDocument();
  });

  it('renders the trailing status when statusKey is given', () => {
    renderList();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('renders a row as one link when `to` is given', () => {
    renderList();
    // Regex, not exact string: jsdom inserts no space between flex children,
    // so the accessible name runs the severity label into the title. The
    // title substring is the assertion; spacing is a jsdom artefact.
    const link = screen.getByRole('link', { name: /Filter service/ });
    expect(link).toHaveAttribute('href', '/work/j1');
  });

  it('renders a row without `to` as plain content, not a link', () => {
    renderList();
    expect(
      screen.queryByRole('link', { name: /Preventive visit/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Preventive visit')).toBeInTheDocument();
  });

  it('renders a free-text detail in place of detailKey (property names are not translatable)', () => {
    render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'jobs',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'j4',
                  titleKey: 'maintenance.filterService.title',
                  detail: 'Rumah Bintaro',
                  severity: 'warning',
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Rumah Bintaro')).toBeInTheDocument();
  });

  it('passes suspected through to the row SeverityIndicator (dashed border, not a fifth colour)', () => {
    const { container } = render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'jobs',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'j5',
                  titleKey: 'maintenance.filterService.title',
                  severity: 'warning',
                  suspected: true,
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(container.querySelector('[class*="suspected"]')).not.toBeNull();
  });

  it('interpolates statusValues into the trailing status', () => {
    render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'route',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'r1',
                  titleKey: 'maintenance.filterService.title',
                  severity: 'warning',
                  statusKey: 'loadState.lastSeen',
                  statusValues: { time: '10:00' },
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Last seen 10:00')).toBeInTheDocument();
  });

  it('renders a free-text title in place of titleKey (property names are not translatable)', () => {
    render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'accounts',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'a1',
                  title: 'Rumah Bintaro',
                  severity: 'warning',
                  to: '/accounts',
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Rumah Bintaro')).toBeInTheDocument();
  });

  it('renders meta columns with caption labels beside their pre-formatted values', () => {
    render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'board',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'w1',
                  titleKey: 'maintenance.filterService.title',
                  severity: 'warning',
                  to: '/work/w1',
                  meta: [
                    { labelKey: 'admin.dispatch.metaSla', value: '18 Sep 2026, 09.00' },
                    { labelKey: 'admin.dispatch.metaAssignee', value: 'Budi Pratama' },
                  ],
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('SLA due')).toBeInTheDocument();
    expect(screen.getByText('18 Sep 2026, 09.00')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('Budi Pratama')).toBeInTheDocument();
  });

  it('states an absent meta value via absentKey rather than rendering nothing', () => {
    render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'board',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'w2',
                  titleKey: 'maintenance.filterService.title',
                  severity: 'warning',
                  meta: [
                    {
                      labelKey: 'admin.dispatch.metaAssignee',
                      value: null,
                      absentKey: 'shared.work-order.unassigned',
                    },
                  ],
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Not yet assigned')).toBeInTheDocument();
  });

  it('renders no meta column at all when the value is null and no absentKey is given', () => {
    render(
      <MemoryRouter>
        <PriorityList
          groups={[
            {
              id: 'board',
              labelKey: 'tech.queue.today',
              items: [
                {
                  id: 'w3',
                  titleKey: 'maintenance.filterService.title',
                  severity: 'warning',
                  meta: [{ labelKey: 'admin.dispatch.metaAssignee', value: null }],
                },
              ],
            },
          ]}
          ariaLabelKey="shell.search"
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Assignee')).not.toBeInTheDocument();
  });
});
