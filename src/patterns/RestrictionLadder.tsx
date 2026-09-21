/**
 * RestrictionLadder — the four rungs of FR-52, drawn as an ordered climb.
 *
 * It existed twice: once on `admin.restriction-case` as four stacked cards,
 * once on `client.billing` as four stacked cards that did not even say which
 * rungs had been passed. Two copies of a safety guarantee is one copy too
 * many — the TrendChart split taught that a fix lands in one of them and the
 * other keeps the defect. The invariants now live here:
 *
 * - The rungs always render in ladder order, all four, whatever is in force.
 * - Only the rung ACTUALLY in force carries a SeverityIndicator. Severity
 *   means "attention now", and a passed or unreachable rung is not that
 *   (D5 UR-MNT-01).
 * - An unreachable rung is stated as blocked rather than omitted, because the
 *   guarantee the reader needs is that `stop` cannot happen here (FR-52) —
 *   and a rung that is not drawn proves nothing.
 * - State is carried in WORDS on every rung; the tint is the second channel,
 *   never the only one.
 *
 * @requirement FR-52
 */
import { useTranslation } from 'react-i18next';
import { SeverityIndicator } from '../components/SeverityIndicator.tsx';
import type { I18nKey } from '../components/contracts.ts';
import {
  RESTRICTION_STEP,
  isStepPermitted,
  restrictionSeverity,
  type RestrictionStep,
} from '../lib/domain/restriction.ts';
import styles from './RestrictionLadder.module.css';

/** Severity of the rung in force decides the tint of its row. */
const TONE: Record<string, string> = {
  critical: styles.critical,
  warning: styles.warning,
  normal: styles.normal,
  unknown: styles.unknown,
};

export function RestrictionLadder({
  current,
  healthSensitive,
  labelKey,
}: {
  /** The rung in force, or null when the account is in good standing. */
  current: RestrictionStep | null;
  /** True when any space on the account is health-sensitive — `stop` is then
   *  unreachable and every rung that names it says so. */
  healthSensitive: boolean;
  labelKey: I18nKey;
}) {
  const { t, i18n } = useTranslation();
  const reached = current === null ? -1 : RESTRICTION_STEP.indexOf(current);

  return (
    <ol className={styles.ladder} aria-label={t(labelKey)}>
      {RESTRICTION_STEP.map((step, index) => {
        const permitted = isStepPermitted(step, { healthSensitive });
        const inForce = step === current;
        const passed = index < reached;
        // Worst news first: a rung that cannot be reached is blocked whether
        // or not the ladder ever got near it.
        const stateKey = !permitted
          ? 'shared.ladder.blocked'
          : inForce
            ? 'shared.ladder.inForce'
            : passed
              ? 'shared.ladder.passed'
              : 'shared.ladder.ahead';
        const severity = restrictionSeverity(step);
        const className = [
          styles.rung,
          inForce ? `${styles.inForce} ${TONE[severity] ?? ''}` : '',
          passed ? styles.passed : '',
          permitted ? '' : styles.blocked,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li key={step} className={className}>
            <span className={styles.rail} aria-hidden="true">
              <span className={styles.marker}>
                {new Intl.NumberFormat(i18n.language).format(index + 1)}
              </span>
            </span>
            <div className={styles.body}>
              <p className={styles.rungName}>{t(`restriction.${step}`)}</p>
              <p className={styles.rungState}>{t(stateKey)}</p>
            </div>
            {inForce ? <SeverityIndicator severity={severity} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
