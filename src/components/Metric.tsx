/**
 * Measured figure with a required provenance label. A null value renders
 * grey with last-seen time — never as zero (D7 §11.2).
 *
 * @requirement FR-15
 */
import type { MetricProps } from './contracts.ts';
import { useTranslation } from 'react-i18next';
import { ProvenanceChip } from './ProvenanceChip.tsx';
import styles from './Metric.module.css';

export function Metric({
  labelKey,
  value,
  unit,
  provenance,
  lastSeen,
  trendKey,
  compact = false,
}: MetricProps) {
  const { t, i18n } = useTranslation();
  const missing = value === null;

  const formatted =
    value === null
      ? t('loadState.noData')
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
          value,
        );

  const seen =
    missing && lastSeen
      ? t('loadState.lastSeen', {
          time: new Intl.DateTimeFormat(i18n.language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(lastSeen)),
        })
      : null;

  const rootClass = [
    styles.root,
    missing ? styles.missing : '',
    compact ? styles.compact : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      {/* Hidden, not dropped: in a table the column header carries the label
          for a sighted reader, and a screen reader reading one cell out of
          context still needs it. */}
      <p className={compact ? 'sr-only' : styles.label}>{t(labelKey)}</p>
      <p className={styles.valueRow}>
        <span className={styles.value}>{formatted}</span>
        {missing ? null : <span className={styles.unit}>{unit}</span>}
      </p>
      <ProvenanceChip provenance={provenance} />
      {trendKey ? <p className={styles.trend}>{t(trendKey)}</p> : null}
      {seen ? <p className={styles.seen}>{seen}</p> : null}
    </div>
  );
}
