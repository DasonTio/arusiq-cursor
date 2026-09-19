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
  SIMULATED_SIGNAL_LIMITS,
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
        <ul className={styles.list}>
          {Object.entries(SIMULATED_SIGNAL_LIMITS).map(([partId, signals]) => {
            return (
              <li key={partId} className={styles.card}>
                <p className={styles.cardTitle}>{t(`part.${partId}`)}</p>
                {Object.entries(signals).map(([signal, limit]) => {
                  return (
                    <p key={signal} className={styles.meta}>
                      {t(`signal.${partId}.${signal}`)} · {format(limit.limit)}{' '}
                      {limit.unit}
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
