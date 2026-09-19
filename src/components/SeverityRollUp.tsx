/**
 * Severity roll-up — D7 §4.2. A roll-up is inspectable rather than a bare
 * colour, so the contributing count travels with it ("2 of 14 need attention")
 * and the whole treatment is the link that opens the contributors.
 *
 * It is one anchor, not a row of controls: a single tab stop carries the mark,
 * the label and the count, so the severity a sighted user sees and the name a
 * screen reader announces are the same sentence. Severity itself is delegated
 * to SeverityIndicator, which is why there is no shape or colour logic here —
 * colour + shape + label cannot be got wrong by composing it.
 *
 * @requirement FR-13 FR-20
 */
import type { SeverityRollUpProps } from './contracts.ts';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SeverityIndicator } from './SeverityIndicator.tsx';
import styles from './SeverityRollUp.module.css';

export function SeverityRollUp({
  severity,
  suspected,
  size,
  contributing,
  total,
  href,
}: SeverityRollUpProps) {
  const { t } = useTranslation();

  return (
    <Link className={styles.root} to={href}>
      <SeverityIndicator severity={severity} suspected={suspected} size={size} />
      <span className={styles.count}>
        {/* `count` is i18next's plural selector as well as an interpolation
            value, so a locale that inflects the noun needs a pack entry and
            not a code change (D5 UR-LANG-01). */}
        {t('severityRollUp.contributing', { count: contributing, total })}
      </span>
    </Link>
  );
}
