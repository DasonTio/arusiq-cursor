/**
 * admin.energy-portfolio — saving vs baseline by site, drawn as one
 * categorical chart (ADR-0011 / ADR-0013) plus the full per-property figures
 * below it as the chart's data table.
 *
 * @requirement FR-61
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { weakestProvenance } from '../../lib/domain/provenance.ts';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  REFERENCE_NOW,
  savingVsBaseline,
  simulatedTelemetry,
  trailingPeriod,
  type EnergySeries,
  type Property,
} from '../../lib/simulation/index.ts';
import { CategoricalChart } from '../../patterns/CategoricalChart.tsx';
import { asChartSeries } from '../../patterns/categoricalSeries.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { ADMIN_REPORTING_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { savingSeries } from './energyPortfolioSeries.ts';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from '../shared/Screen.module.css';

export default function EnergyPortfolio() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [rows, setRows] = useState(
    [] as { property: Property; series: EnergySeries }[],
  );
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    const period = trailingPeriod(new Date(REFERENCE_NOW), 30);
    void simulatedTelemetry
      .listProperties(scope)
      .then(async (properties) => {
        const next = await Promise.all(
          properties.map(async (property) => {
            const series = await simulatedTelemetry.getEnergy(
              scope,
              property.id,
              period,
            );
            return { property, series };
          }),
        );
        if (cancelled) return;
        setRows(next);
        setState(next.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.energy-portfolio.title')}</h1>
        <p className={styles.stateBody}>{t('admin.energy-portfolio.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.energy-portfolio.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.energy-portfolio.title')}</h1>
        <p className={styles.stateBody}>{t('admin.energy-portfolio.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.energy-portfolio.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.energy-portfolio.title')}</h1>
        <p className={styles.stateBody}>{t('admin.energy-portfolio.empty')}</p>
      </section>
    );
  }

  const chartSeries = asChartSeries(
    rows.map((row) => savingSeries(row.property.name, row.series)),
  );

  return (
    <div className={styles.root}>
      <ViewTabs items={ADMIN_REPORTING_VIEWS} />
      <PageHeader
        titleKey="admin.energy-portfolio.title"
        contextKey="admin.energy-portfolio.purpose"
      />
      {chartSeries ? (
        <CategoricalChart
          accessibleNameKey="admin.energy-portfolio.chartAlt"
          series={chartSeries}
          unit="kWh"
          provenance={weakestProvenance(rows.map((row) => row.series.provenance))}
          textAlternative={{ kind: 'table' }}
        />
      ) : (
        <p className={styles.meta}>{t('admin.energy-portfolio.chartTooMany')}</p>
      )}
      <ul className={styles.list}>
        {rows.map((row) => {
          const saving = savingVsBaseline(row.series);
          return (
            <li key={row.property.id} className={styles.card}>
              <p className={styles.cardTitle}>{row.property.name}</p>
              <Metric
                labelKey="client.energy.savingKwh"
                value={saving.kWh.value}
                unit="kWh"
                provenance={saving.kWh.provenance}
                lastSeen={saving.kWh.lastSeen}
              />
              <Metric
                labelKey="client.energy.savingPct"
                value={saving.pct.value}
                unit="%"
                provenance={saving.pct.provenance}
                lastSeen={saving.pct.lastSeen}
              />
              <p className={styles.meta}>
                {t('admin.energy-portfolio.completeness', {
                  value: format(row.series.completeness * 100),
                })}
              </p>
              <Button variant="ghost" to={row.series.method.href}>
                {t('admin.energy-portfolio.methodLink')}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
