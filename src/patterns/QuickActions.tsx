/**
 * QuickActions — the client Home shortcut row (FR-10): circular icon actions
 * with visible captions, as a link (`to`) or a button (`onClick`). Captions
 * are never dropped for icons — an icon-only control would fail D7 §7.1, so
 * the glyph renders aria-hidden and the localised label stays visible and
 * names the control. The nav's accessible name arrives as a key because the
 * locale packs are owned outside this pattern.
 *
 * @requirement FR-10
 */
import { Fragment } from 'react';
import type { I18nKey, IconComponent } from '../components/contracts.ts';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon.tsx';
import styles from './QuickActions.module.css';

export interface QuickActionItem {
  id: string;
  icon: IconComponent;
  labelKey: I18nKey;
  to?: string;
  onClick?: () => void;
}

export interface QuickActionsProps {
  items: readonly QuickActionItem[];
  ariaLabelKey: I18nKey;
}

export function QuickActions({ items, ariaLabelKey }: QuickActionsProps) {
  const { t } = useTranslation();

  const actionBody = (item: QuickActionItem) => {
    return (
      <>
        <span className={styles.circle}>
          <Icon icon={item.icon} size={24} />
        </span>
        <span className={styles.caption}>{t(item.labelKey)}</span>
      </>
    );
  };

  return (
    <nav className={styles.root} aria-label={t(ariaLabelKey)}>
      {items.map((item) => (
        <Fragment key={item.id}>
          {item.to ? (
            <Link className={styles.action} to={item.to}>
              {actionBody(item)}
            </Link>
          ) : (
            <button type="button" className={styles.action} onClick={item.onClick}>
              {actionBody(item)}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
