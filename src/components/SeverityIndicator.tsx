/**
 * Severity always carries colour + shape + label. There is no colour prop
 * and no solid-filled variant (ADR-0002).
 *
 * @requirement FR-20 FR-25
 */
import type { SeverityIndicatorProps } from './contracts.ts';
import { SEVERITY, type Severity } from '../lib/domain/severity.ts';
import { useTranslation } from 'react-i18next';
import styles from './SeverityIndicator.module.css';

function Mark({ severity }: { severity: Severity }) {
  const shape = SEVERITY[severity].shape;

  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {shape === 'square' ? <rect x="5" y="5" width="14" height="14" rx="1" /> : null}
      {shape === 'triangle' ? <polygon points="12,5 21,19 3,19" /> : null}
      {shape === 'circle' ? <circle cx="12" cy="12" r="7" /> : null}
      {shape === 'dashedRing' ? (
        <circle
          cx="12"
          cy="12"
          r="7"
          fill="none"
          strokeDasharray="3 3"
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}

export function SeverityIndicator({
  severity,
  suspected = false,
  size = 24,
}: SeverityIndicatorProps) {
  const { t } = useTranslation();
  const className = [styles.root, styles[severity], suspected ? styles.suspected : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} data-size={size}>
      <span className={styles.mark}>
        <Mark severity={severity} />
      </span>
      <span className={styles.label}>{t(SEVERITY[severity].labelKey)}</span>
    </span>
  );
}
