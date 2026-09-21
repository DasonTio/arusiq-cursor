/**
 * AssetTree — the rules that keep a hierarchy from becoming packaging.
 *
 * @requirement FR-13 FR-14
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AssetTree } from './AssetTree.tsx';
import type { TreeNode } from '../components/contracts.ts';

const unit: TreeNode = {
  id: 'unit-a',
  name: 'Living Room A',
  href: '/spaces?node=unit-a',
  rollUp: { severity: 'normal', contributing: 0, total: 12 },
};

const nodes: TreeNode[] = [
  {
    id: 'prop-1',
    name: 'Rumah Bintaro',
    href: '/spaces?node=prop-1',
    rollUp: { severity: 'critical', contributing: 7, total: 9 },
    children: [
      {
        id: 'floor-1',
        name: 'Ground floor',
        href: '/spaces?node=floor-1',
        rollUp: { severity: 'critical', contributing: 4, total: 5 },
        children: [
          {
            id: 'room-1',
            name: 'Nursery',
            href: '/spaces?node=room-1',
            healthSensitive: true,
            rollUp: { severity: 'normal', contributing: 0, total: 1 },
            children: [unit],
          },
        ],
      },
    ],
  },
];

function renderTree() {
  return render(
    <MemoryRouter>
      <AssetTree
        nodes={nodes}
        labelKey="client.spaces.title"
        sensitiveLabelKey="client.spaces.healthSensitive"
      />
    </MemoryRouter>,
  );
}

describe('AssetTree', () => {
  it('draws one panel, not a box per level', () => {
    // Four levels of card-in-card was the shape both screens had: every level
    // added a border, a radius and a shadow, so a unit sat four boxes deep.
    const { container } = renderTree();
    expect(container.querySelectorAll('[class*="tree"]')).toHaveLength(1);
  });

  it('gives every row exactly one anchor, to its own node', () => {
    renderTree();
    // Spaces printed each unit's name twice — as text and as a ghost button —
    // and carried two links to the same place.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/spaces?node=prop-1',
      '/spaces?node=floor-1',
      '/spaces?node=room-1',
      '/spaces?node=unit-a',
    ]);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks a health-sensitive space wherever it appears — FR-53', () => {
    renderTree();
    expect(screen.getByText('Health-sensitive')).toBeInTheDocument();
  });

  it('keeps the hierarchy nested, so depth survives without a box', () => {
    renderTree();
    const tree = screen.getByRole('list', { name: 'Spaces' });
    const site = within(tree).getAllByRole('listitem')[0];
    // The floor is INSIDE the site's item, not a sibling of it.
    expect(within(site).getByText('Ground floor')).toBeInTheDocument();
    expect(within(site).getByText('Living Room A')).toBeInTheDocument();
  });
});
