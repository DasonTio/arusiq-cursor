/**
 * admin.settings — the published tariff and grid tables, the part thresholds
 * the product actually evaluates against, and who holds which role.
 *
 * Every one of the three is the same shape: fields that repeat. They were
 * drawn as two loose paragraphs, twelve cards of stacked sentences and four
 * more cards holding two lines each — about 1,700 px for what a table says in
 * 700. `35-dashboard-composition.md` §3: repeating fields are a table.
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
import { DataTable } from '../../patterns/DataTable.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import styles from '../shared/Screen.module.css';

/** One published rate: what it is, what it is worth, who published it. */
interface PublishedRate {
  id: string;
  labelKey: string;
  value: string;
  source: string;
  effectiveFrom: string;
}

/** One row of the threshold table: a part, a signal, and the rule. */
interface ThresholdRow {
  id: string;
  partId: string;
  signalKey: string;
  unit: string;
  threshold: number;
  decimals: number;
  direction: 'above' | 'below';
}

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

  const rates: PublishedRate[] = [
    {
      id: 'tariff',
      labelKey: 'admin.settings.tariffs',
      value: t('admin.settings.perKWh', { value: formatIdr(TARIFF.idrPerKWh) }),
      source: TARIFF.source,
      effectiveFrom: TARIFF.effectiveFrom,
    },
    {
      id: 'grid',
      labelKey: 'admin.settings.grid',
      value: t('admin.settings.kgPerKWh', { value: format(GRID_FACTOR.value) }),
      source: GRID_FACTOR.source,
      effectiveFrom: GRID_FACTOR.effectiveFrom,
    },
  ];

  /* Straight from PART_CATALOGUE — the table every alert, evidence line and
     checklist is evaluated against. Rendering a second, display-only copy is
     how this screen came to publish limits the product did not use. */
  const thresholds: ThresholdRow[] = PART_CATALOGUE.flatMap((part) =>
    part.signals.map((signal) => ({
      id: `${part.id}-${signal.key}`,
      partId: part.id,
      signalKey: signal.key,
      unit: signal.unit,
      threshold: signal.threshold,
      decimals: signal.decimals,
      direction: signal.direction,
    })),
  );

  return (
    <div className={styles.root}>
      <PageHeader titleKey="admin.settings.title" contextKey="admin.settings.purpose" />

      <section className={styles.section}>
        <SectionHeader titleKey="admin.settings.published" />
        <DataTable
          captionKey="admin.settings.published"
          rows={rates}
          rowKey={(rate) => rate.id}
          columns={[
            {
              key: 'table',
              labelKey: 'admin.settings.colTable',
              rowHeader: true,
              cell: (rate) => t(rate.labelKey),
            },
            {
              key: 'value',
              labelKey: 'admin.settings.colValue',
              numeric: true,
              cell: (rate) => rate.value,
            },
            {
              key: 'source',
              labelKey: 'admin.settings.colSource',
              cell: (rate) => rate.source,
            },
            {
              key: 'from',
              labelKey: 'admin.settings.colFrom',
              numeric: true,
              cell: (rate) => (
                <time dateTime={rate.effectiveFrom}>
                  {formatDate(rate.effectiveFrom)}
                </time>
              ),
            },
          ]}
        />
      </section>

      <section className={styles.section}>
        <SectionHeader titleKey="admin.settings.thresholds" />
        <MockBoundary explanationKey="admin.settings.preview">
          <DataTable
            captionKey="admin.settings.thresholds"
            rows={thresholds}
            rowKey={(row) => row.id}
            columns={[
              {
                key: 'part',
                labelKey: 'admin.settings.colPart',
                rowHeader: true,
                cell: (row) => t(`part.${row.partId}`),
              },
              {
                key: 'signal',
                labelKey: 'admin.settings.colSignal',
                cell: (row) => t(`signal.${row.partId}.${row.signalKey}`),
              },
              {
                // A bare "198 V" reads as a ceiling. Supply voltage and
                // airflow are floors — the direction is half the rule, so it
                // gets a column of its own rather than riding inside the
                // sentence where it was easy to skim past.
                key: 'rule',
                labelKey: 'admin.settings.colRule',
                cell: (row) =>
                  t(
                    row.direction === 'below'
                      ? 'admin.settings.ruleBelow'
                      : 'admin.settings.ruleAbove',
                  ),
              },
              {
                key: 'limit',
                labelKey: 'admin.settings.colLimit',
                numeric: true,
                cell: (row) =>
                  t('admin.settings.limitValue', {
                    value: formatLimit(row.threshold, row.decimals),
                    unit: row.unit,
                  }),
              },
            ]}
          />
        </MockBoundary>
      </section>

      <section className={styles.section}>
        <SectionHeader titleKey="admin.settings.users" />
        <DataTable
          captionKey="admin.settings.users"
          rows={[...DEMO_ACCOUNTS]}
          rowKey={(account) => account.id}
          columns={[
            {
              key: 'name',
              labelKey: 'admin.settings.colName',
              rowHeader: true,
              cell: (account) => account.name,
            },
            {
              key: 'role',
              labelKey: 'admin.settings.colRole',
              cell: (account) => t(`roles.${account.role}`),
            },
          ]}
        />
      </section>
    </div>
  );
}
