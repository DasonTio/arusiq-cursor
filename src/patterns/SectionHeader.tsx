/**
 * Section header — the `<h2>` row above every major screen section, with a
 * trailing slot for a link or meta ("See all", a count, a chip). Used by all
 * four archetypes; screens own the locale strings (D5 UR-LANG-01).
 *
 * @requirement FR-10 FR-15
 */
import type { ReactNode } from 'react';
import type { I18nKey } from '../components/contracts.ts';
import { useTranslation } from 'react-i18next';
import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  titleKey: I18nKey;
  children?: ReactNode;
}

export function SectionHeader({ titleKey, children }: SectionHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{t(titleKey)}</h2>
      {children ? <div className={styles.trailing}>{children}</div> : null}
    </div>
  );
}
