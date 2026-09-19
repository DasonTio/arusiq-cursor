/**
 * Button primitive. One primary action per area — the variant is how that
 * rule is visible, not a palette of equal choices.
 *
 * Selection is the second channel (ADR-0014): `variant="primary"` is how a
 * chosen chip or tab looks, `pressed` / `current` is what it is. Neither prop
 * touches the class list, so adding one changes nothing on screen.
 */
import type { ButtonProps } from './contracts.ts';
import { Link } from 'react-router';
import styles from './Button.module.css';

export function Button({
  variant,
  type = 'button',
  disabled,
  onClick,
  to,
  pressed,
  current,
  children,
}: ButtonProps) {
  const className = `${styles.root} ${styles[variant]}`;

  // `aria-current` is a GLOBAL state, so it is legal on the link, the button
  // and the disabled span alike — which is why the same prop serves all three.
  //
  // Its value is derived here rather than passed in. `page` means "the current
  // page within a set of pages", so it is right for a tab that navigates — and
  // it is what `NavLink` already emits in `ViewTabs`, so a query-param tab and
  // a routed tab announce identically instead of being two patterns that look
  // the same. `true` means "the current item within a set", which is what a
  // `<button>` view tab is: nothing navigated, the view just changed.
  const ariaCurrent = current ? (to ? 'page' : true) : undefined;

  if (to) {
    if (disabled) {
      return (
        <span className={className} aria-disabled="true" aria-current={ariaCurrent}>
          {children}
        </span>
      );
    }
    return (
      <Link className={className} to={to} onClick={onClick} aria-current={ariaCurrent}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={className}
      type={type}
      disabled={disabled}
      onClick={onClick}
      // Undefined omits the attribute; `false` renders `aria-pressed="false"`,
      // which is the point of the boolean — see the contract.
      aria-pressed={pressed}
      aria-current={ariaCurrent}
    >
      {children}
    </button>
  );
}
