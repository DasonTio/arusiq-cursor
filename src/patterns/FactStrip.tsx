/**
 * FactStrip — labelled fields in columns.
 *
 * Three screens arrived at this independently: the work order's meta strip,
 * the client restriction record, the admin case record. Each was five or six
 * `<p>` in a column before that, which is the text-dump card from
 * `35-dashboard-composition.md` §4 — the reader has to parse every sentence
 * to find the one field they came for.
 *
 * Layout only. Formatting belongs to the caller, which is why `value` is a
 * node: a date arrives as a time element, a figure as a Metric.
 *
 * @requirement FR-52
 */
import { useTranslation } from 'react-i18next';
import type { FactStripProps } from '../components/contracts.ts';
import styles from './FactStrip.module.css';

const COLUMNS = {
  2: styles.two,
  3: styles.three,
  4: styles.four,
};

export function FactStrip({ fields, columns = 4 }: FactStripProps) {
  const { t } = useTranslation();

  return (
    <dl className={`${styles.facts} ${COLUMNS[columns]}`}>
      {fields.map((field) => {
        const className = field.wide ? `${styles.fact} ${styles.wide}` : styles.fact;
        return (
          <div key={field.labelKey} className={className}>
            <dt className={styles.label}>{t(field.labelKey)}</dt>
            <dd className={styles.value}>{field.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
