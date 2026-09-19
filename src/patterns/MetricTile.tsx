/**
 * MetricTile — the card shell the client Home KPI summary composes: a raised,
 * bordered surface that holds a `<Metric/>` plus an optional caption. It is
 * layout only; the figure and its provenance come from the Metric primitive
 * (D6 NFR: every figure carries a provenance label).
 *
 * @requirement FR-10
 */
import type { ReactNode } from 'react';
import styles from './MetricGrid.module.css';

export function MetricTile({ children }: { children: ReactNode }) {
  return <div className={styles.tile}>{children}</div>;
}
