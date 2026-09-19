/**
 * client.carbon — Scope 2 and avoided emissions. Indoor CO₂ ppm never appears.
 *
 * @requirement FR-70 FR-71 FR-66
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  REFERENCE_NOW,
  simulatedTelemetry,
  trailingPeriod,
  walkUnits,
  type CarbonSummary,
  type EnergySeries,
  type Property,
} from '../../lib/simulation/index.ts';
import { MetricGrid } from '../../patterns/MetricGrid.tsx';
import { MetricTile } from '../../patterns/MetricTile.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { INSIGHT_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { MethodPanel } from '../shared/Method.tsx';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from './Energy.module.css';

export default function Carbon() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const days = params.get('days') === '7' ? 7 : 30;
  const showMethod = params.get('method') !== null;
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [home, setHome] = useState(null as Property | null);
  const [carbon, setCarbon] = useState(null as CarbonSummary | null);
  const [energy, setEnergy] = useState(null as EnergySeries | null);
  const [heartbeat, setHeartbeat] = useState(null as string | null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    const period = trailingPeriod(new Date(REFERENCE_NOW), days);
    void simulatedTelemetry
      .listProperties(scope)
      .then(async (properties) => {
        const property = properties[0] ?? null;
        if (!property) {
          if (!cancelled) {
            setHome(null);
            setState('empty');
          }
          return;
        }
        const units = walkUnits([property]);
        const [nextCarbon, nextEnergy] = await Promise.all([
          simulatedTelemetry.getCarbon(scope, property.id, period),
          simulatedTelemetry.getEnergy(scope, property.id, period),
        ]);
        if (cancelled) return;
        setHome(property);
        setCarbon(nextCarbon);
        setEnergy(nextEnergy);
        setHeartbeat(
          units.map((unit) => unit.device.lastHeartbeat).find((iso) => iso !== null) ??
            null,
        );
        const silent = units.length > 0 && units.every((unit) => !unit.device.online);
        if (silent && nextCarbon.scope2KgCO2e.value === null) {
          setState('noData');
          return;
        }
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry, days]);

  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(iso),
    );

  if (showMethod) {
    return (
      <div className={styles.root}>
        <ViewTabs items={INSIGHT_VIEWS} />
        <MethodPanel backTo={`/insights/carbon?days=${days}`} />
      </div>
    );
  }

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.carbon.title')}</h1>
        <p className={styles.stateBody}>{t('client.carbon.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.carbon.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.carbon.title')}</h1>
        <p className={styles.stateBody}>{t('client.carbon.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.carbon.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty' || !home || !carbon) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.carbon.title')}</h1>
        <p className={styles.stateBody}>{t('client.carbon.empty')}</p>
        <Button variant="primary" to="/insights">
          {t('client.carbon.emptyAction')}
        </Button>
      </section>
    );
  }

  if (state === 'noData') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.carbon.noDataTitle')}</h1>
        <p className={styles.stateBody}>{t('client.carbon.noDataBody')}</p>
        {heartbeat ? (
          <p className={styles.meta}>
            {t('loadState.lastSeen', { time: formatDate(heartbeat) })}
          </p>
        ) : null}
        <Button variant="primary" to="/insights">
          {t('client.carbon.noDataAction')}
        </Button>
      </section>
    );
  }

  const usedKWh = energy
    ? energy.actual.reduce((sum, point) => {
        return sum + point.kWh;
      }, 0)
    : null;

  return (
    <div className={styles.root}>
      <ViewTabs items={INSIGHT_VIEWS} />
      <PageHeader titleKey="client.carbon.title" contextKey="client.carbon.purpose" />
      <div className={styles.choices}>
        <Button
          variant={days === 7 ? 'primary' : 'ghost'}
          current={days === 7}
          to="/insights/carbon?days=7"
        >
          {t('client.carbon.days7')}
        </Button>
        <Button
          variant={days === 30 ? 'primary' : 'ghost'}
          current={days === 30}
          to="/insights/carbon?days=30"
        >
          {t('client.carbon.days30')}
        </Button>
      </div>
      <MetricGrid>
        <MetricTile>
          <Metric
            labelKey="client.carbon.scope2"
            value={carbon.scope2KgCO2e.value}
            unit="kgCO₂e"
            provenance={carbon.scope2KgCO2e.provenance}
            lastSeen={carbon.scope2KgCO2e.lastSeen}
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="client.carbon.avoided"
            value={carbon.avoidedKgCO2e.value}
            unit="kgCO₂e"
            provenance={carbon.avoidedKgCO2e.provenance}
            lastSeen={carbon.avoidedKgCO2e.lastSeen}
          />
        </MetricTile>
      </MetricGrid>
      <p className={styles.meta}>
        {t('client.carbon.gridFactor', {
          value: format(carbon.gridFactor.value),
          source: carbon.gridFactor.source,
          date: formatDate(carbon.gridFactor.effectiveFrom),
        })}
      </p>
      <ProvenanceChip provenance={carbon.scope2KgCO2e.provenance} />
      {energy ? (
        <p className={styles.meta}>
          {t('client.carbon.completeness', {
            value: format(energy.completeness * 100),
          })}
        </p>
      ) : null}
      <Button
        variant="ghost"
        to={energy?.method.href ?? '/insights?method=adjusted-baseline-v2'}
      >
        {t('client.carbon.methodLink')}
      </Button>
      <section className={styles.section}>
        <SectionHeader titleKey="client.carbon.reportTitle" />
        <p>
          {t('client.carbon.reportBody', {
            used: usedKWh === null ? t('loadState.noData') : format(usedKWh),
            avoided:
              carbon.avoidedKgCO2e.value === null
                ? t('loadState.noData')
                : format(carbon.avoidedKgCO2e.value),
          })}
        </p>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="client.carbon.offsetTitle" />
        <p className={styles.meta}>{t('client.carbon.offsetMock')}</p>
        <p>{t('client.carbon.offsetBody')}</p>
      </section>
    </div>
  );
}
