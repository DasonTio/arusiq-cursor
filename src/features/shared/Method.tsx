/**
 * shared.method — the reference room every savings and emissions figure
 * links to. The chart is not permitted without this.
 *
 * @requirement FR-61 FR-66 FR-70 FR-71
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { BASELINE_METHOD, GRID_FACTOR, TARIFF } from '../../lib/simulation/index.ts';
import styles from './Method.module.css';

const PROVENANCE = ['simulated', 'estimated', 'provisional', 'verified'] as const;

export function MethodPanel({ backTo = '/insights' }: { backTo?: string }) {
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
    <section className={styles.root} aria-labelledby="method-title">
      <Button variant="ghost" to={backTo}>
        {t('shared.method.back')}
      </Button>
      <h1 id="method-title">{t('shared.method.title')}</h1>
      <p className={styles.meta}>{t('shared.method.purpose')}</p>
      <p>{t('shared.method.model', { id: BASELINE_METHOD.id })}</p>
      <p className={styles.meta}>
        {t('shared.method.version', { version: BASELINE_METHOD.version })}
      </p>
      <h2 className={styles.sectionTitle}>{t('shared.method.tariffTitle')}</h2>
      <p>
        {t('shared.method.tariffLine', {
          value: formatIdr(TARIFF.idrPerKWh),
          source: TARIFF.source,
          date: formatDate(TARIFF.effectiveFrom),
        })}
      </p>
      <h2 className={styles.sectionTitle}>{t('shared.method.gridTitle')}</h2>
      <p>
        {t('shared.method.gridLine', {
          value: format(GRID_FACTOR.value),
          source: GRID_FACTOR.source,
          date: formatDate(GRID_FACTOR.effectiveFrom),
        })}
      </p>
      <h2 className={styles.sectionTitle}>{t('shared.method.provenanceTitle')}</h2>
      <ul className={styles.list}>
        {PROVENANCE.map((item) => {
          return (
            <li key={item} className={styles.row}>
              <ProvenanceChip provenance={item} />
            </li>
          );
        })}
      </ul>
      <h2 className={styles.sectionTitle}>{t('shared.method.glossaryTitle')}</h2>
      <p>{t('shared.method.glossaryPpm')}</p>
      <p>{t('shared.method.glossaryEmissions')}</p>
    </section>
  );
}

export default MethodPanel;
