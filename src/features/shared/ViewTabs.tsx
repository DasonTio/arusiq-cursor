/**
 * In-destination view switcher (Insights energy/carbon, Account bills/visits).
 *
 * @requirement FR-04
 */
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './ViewTabs.module.css';

export interface ViewTab {
  to: string;
  labelKey: string;
  end?: boolean;
}

export function ViewTabs({ items }: { items: readonly ViewTab[] }) {
  const { t } = useTranslation();

  return (
    <nav className={styles.root} aria-label={t('shell.views')}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.active}` : styles.tab
          }
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
