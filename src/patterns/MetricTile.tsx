/**
 * MetricTile — the card shell the KPI summaries compose: a raised surface
 * holding a `<Metric/>` plus an optional caption. It is layout only; the
 * figure and its provenance come from the Metric primitive (D6 NFR: every
 * figure carries a provenance label).
 *
 * ADR-0018 adds an optional tinted icon chip. It is a focal point and a
 * domain cue, not a status: a tile that needs to say "this is bad" still
 * does it with a SeverityIndicator, because colour never travels alone
 * (D5 UR-MNT-01). `tone` therefore names a CHANNEL — accent, eco, info — or
 * the severity family when the figure genuinely is a severity count.
 *
 * @requirement FR-10
 */
import type { ComponentType, ReactNode } from 'react';
import { Icon } from '../components/Icon.tsx';
import type { I18nKey } from '../components/contracts.ts';
import styles from './MetricGrid.module.css';

export type TileTone = 'accent' | 'eco' | 'info' | 'warning' | 'critical';

const TONE_CLASS: Record<TileTone, string> = {
  accent: '',
  eco: styles.toneEco,
  info: styles.toneInfo,
  warning: styles.toneWarning,
  critical: styles.toneCritical,
};

export function MetricTile({
  children,
  icon,
  tone = 'accent',
  iconLabelKey,
}: {
  children: ReactNode;
  /** A Lucide glyph. The chip is omitted entirely when this is absent, so
   *  existing callers render exactly as before. */
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: TileTone;
  /** Only when the glyph carries meaning the label does not already give. */
  iconLabelKey?: I18nKey;
}) {
  return (
    <div className={styles.tile}>
      {icon ? (
        <p className={`${styles.tileHead} ${TONE_CLASS[tone]}`}>
          <span className={styles.tileChip}>
            <Icon icon={icon} size={20} labelKey={iconLabelKey} />
          </span>
        </p>
      ) : null}
      {children}
    </div>
  );
}
