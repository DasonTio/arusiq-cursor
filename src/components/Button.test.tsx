import { beforeAll, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import i18n from '../lib/i18n/index.ts';
import { Button } from './Button.tsx';

/**
 * ADR-0014. The failure this file exists to prevent is invisible in a
 * screenshot and invisible in a code review: a row of chips where the chosen
 * one is navy and the rest are ghost, and every one of them announces
 * "Cooling, button". Colour was the only channel.
 *
 * So the assertions are on the ACCESSIBILITY TREE rather than on class names —
 * the class list was already correct before the bug and stayed correct all the
 * way through it.
 *
 * The fixture labels come from a locale bundle rather than sitting as literals
 * in the JSX. `Button` renders whatever children it is given, and in this
 * product those are always a caller's `t()` output; a test that does it
 * differently is the one place a component displays a string that never passed
 * through a pack. The keys below are local to this file.
 */
beforeAll(() => {
  i18n.addResourceBundle(
    'en',
    'translation',
    {
      buttonFixture: {
        send: 'Send',
        unit: 'Unit 1',
        cooling: 'Cooling',
        dry: 'Dry',
        now: 'Now',
        health: 'Health',
        control: 'Control',
      },
    },
    true,
    true,
  );
});

const label = (key: string): string => i18n.t(`buttonFixture.${key}`);

function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Button — selection is not carried by colour alone', () => {
  it('adds nothing when neither selection prop is passed', () => {
    render(<Button variant="primary">{label('send')}</Button>);
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).not.toHaveAttribute('aria-pressed');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('adds nothing to a link when `current` is not passed', () => {
    renderInRouter(
      <Button variant="ghost" to="/unit/1">
        {label('unit')}
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Unit 1' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  describe('toggle semantics — filter chips, mode and fan pickers, approvals', () => {
    it('announces the chosen member as pressed and the rest as not pressed', () => {
      render(
        <>
          <Button variant="primary" pressed={true}>
            {label('cooling')}
          </Button>
          <Button variant="ghost" pressed={false}>
            {label('dry')}
          </Button>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Cooling' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // The load-bearing half: `false` must REACH THE DOM. A group where only
      // the chosen member carries `aria-pressed` announces one toggle button
      // beside a plain one, and a different set each time the choice moves.
      expect(screen.getByRole('button', { name: 'Dry' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('exposes the whole group through the pressed-state query', () => {
      render(
        <div role="group" aria-labelledby="fixture-mode">
          <Button variant="primary" pressed={true}>
            {label('cooling')}
          </Button>
          <Button variant="ghost" pressed={false}>
            {label('dry')}
          </Button>
        </div>,
      );
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
      expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(1);
    });

    it('does not also claim to be the current item', () => {
      render(
        <Button variant="primary" pressed={true}>
          {label('cooling')}
        </Button>,
      );
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-current');
    });
  });

  describe('current semantics — view tabs that are not a tablist', () => {
    it('marks a non-navigating view tab as the current item, not as pressed', () => {
      render(
        <Button variant="primary" current={true}>
          {label('health')}
        </Button>,
      );
      const tab = screen.getByRole('button', { name: 'Health' });
      // `true` — "the current item within a set". Nothing was toggled.
      expect(tab).toHaveAttribute('aria-current', 'true');
      expect(tab).not.toHaveAttribute('aria-pressed');
    });

    it('marks a navigating view tab as the current page, matching NavLink', () => {
      renderInRouter(
        <Button variant="primary" current={true} to="/unit/1?view=health">
          {label('health')}
        </Button>,
      );
      // `page` is what `NavLink` already emits in `ViewTabs`, so a query-param
      // tab and a routed tab announce the same rather than being two patterns
      // that merely look alike.
      expect(screen.getByRole('link', { name: 'Health' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('is absent rather than "false" on the members that are not current', () => {
      render(
        <>
          <Button variant="primary" current={true}>
            {label('now')}
          </Button>
          <Button variant="ghost" current={false}>
            {label('health')}
          </Button>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Health' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('survives the disabled-link branch, which renders a span', () => {
      renderInRouter(
        <Button variant="ghost" current={true} disabled to="/unit/1?view=control">
          {label('control')}
        </Button>,
      );
      const span = screen.getByText('Control');
      expect(span).toHaveAttribute('aria-disabled', 'true');
      expect(span).toHaveAttribute('aria-current', 'page');
    });
  });
});
