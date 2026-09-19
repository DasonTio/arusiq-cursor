/**
 * Marks a Phase 1A surface as a mock so an unlabelled prototype is not
 * mistaken for a live system (D7 §14.4).
 *
 * @requirement FR-01
 */
import type { MockBoundaryProps } from './contracts.ts';
import { useTranslation } from 'react-i18next';
import styles from './MockBoundary.module.css';

export function MockBoundary({ explanationKey, children }: MockBoundaryProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.root}>
      <p className={styles.banner} role="status">
        {t(explanationKey)}
      </p>
      {children}
    </div>
  );
}
