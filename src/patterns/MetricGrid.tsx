/**
 * MetricGrid — the responsive KPI grid for the client Home summary (FR-10).
 * Two columns on the phone frame, relaxing to up to four on one row from the
 * tablet frame. A plain div, not a landmark: screens own the headings and the
 * section structure around it.
 *
 * @requirement FR-10
 */
import type { ReactNode } from 'react';
import styles from './MetricGrid.module.css';

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
