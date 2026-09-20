/**
 * admin.settings — published tariff/grid tables and simulated thresholds.
 *
 * @requirement FR-27 FR-100 FR-101
 */
import { useTranslation } from 'react-i18next';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import {
  DEMO_ACCOUNTS,
  GRID_FACTOR,
  PART_CATALOGUE,
  TARIFF,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import styles from '../shared/Screen.module.css';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 4 }).format(value);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  /** Each signal declares the precision it is read at; a threshold shown to
   *  more places than the reading suggests a tolerance nothing measures. */
  const formatLimit = (value: number, decimals: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: decimals }).format(
      value,
    );
  const formatIdr = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 1,
    }).format(value);

  return (
    <div className={styles.root}>
      <PageHeader titleKey="admin.settings.title" contextKey="admin.settings.purpose" />
      <section className={styles.section}>
        <SectionHeader titleKey="admin.settings.tariffs" />
        <p>
          {t('shared.method.tariffLine', {
            value: formatIdr(TARIFF.idrPerKWh),
            source: TARIFF.source,
            date: formatDate(TARIFF.effectiveFrom),
          })}
        </p>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.settings.grid" />
        <p>
          {t('shared.method.gridLine', {
            value: format(GRID_FACTOR.value),
            source: GRID_FACTOR.source,
            date: formatDate(GRID_FACTOR.effectiveFrom),
          })}
        </p>
      </section>
      <MockBoundary explanationKey="admin.settings.preview">
        <SectionHeader titleKey="admin.settings.thresholds" />
        {/* Straight from PART_CATALOGUE — the table every alert, evidence
            line and checklist is evaluated against. Rendering a second,
            display-only copy is how this screen came to publish limits the
            product did not use. */}
        <ul className={styles.list}>
          {PART_CATALOGUE.map((part) => {
            return (
              <li key={part.id} className={styles.card}>
                <p className={styles.cardTitle}>{t(`part.${part.id}`)}</p>
                {part.signals.map((signal) => {
                  // A bare "198 V" reads as a ceiling. Supply voltage and
                  // airflow are floors — the direction is half the rule.
                  const line =
                    signal.direction === 'below'
                      ? 'admin.settings.limitBelow'
                      : 'admin.settings.limitAbove';
                  return (
                    <p key={signal.key} className={styles.meta}>
                      {t(line, {
                        signal: t(`signal.${part.id}.${signal.key}`),
                        value: formatLimit(signal.threshold, signal.decimals),
                        unit: signal.unit,
                      })}
                    </p>
                  );
                })}
              </li>
            );
          })}
        </ul>
      </MockBoundary>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.settings.users" />
        <ul className={styles.list}>
          {DEMO_ACCOUNTS.map((account) => {
            return (
              <li key={account.id} className={styles.card}>
                <p className={styles.cardTitle}>{account.name}</p>
                <p className={styles.meta}>{t(`roles.${account.role}`)}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
