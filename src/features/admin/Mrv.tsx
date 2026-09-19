/**
 * admin.mrv — Scope 2 and avoided emissions by site. Registry export is mocked.
 *
 * @requirement FR-70 FR-71 FR-73 FR-74
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  REFERENCE_NOW,
  simulatedTelemetry,
  trailingPeriod,
  type CarbonSummary,
  type Property,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { ADMIN_REPORTING_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from '../shared/Screen.module.css';

export default function Mrv() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [rows, setRows] = useState(
    [] as { property: Property; carbon: CarbonSummary }[],
  );
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
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
            const carbon = await simulatedTelemetry.getCarbon(
              scope,
              property.id,
              period,
            );
            return { property, carbon };
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
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(value);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(iso),
    );

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.mrv.title')}</h1>
        <p className={styles.stateBody}>{t('admin.mrv.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.mrv.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.mrv.title')}</h1>
        <p className={styles.stateBody}>{t('admin.mrv.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.mrv.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.mrv.title')}</h1>
        <p className={styles.stateBody}>{t('admin.mrv.empty')}</p>
      </section>
    );
  }

  const factor = rows[0]?.carbon.gridFactor;

  return (
    <div className={styles.root}>
      <ViewTabs items={ADMIN_REPORTING_VIEWS} />
      <PageHeader titleKey="admin.mrv.title" contextKey="admin.mrv.purpose" />
      {factor ? (
        <p className={styles.meta}>
          {t('client.carbon.gridFactor', {
            value: format(factor.value),
            source: factor.source,
            date: formatDate(factor.effectiveFrom),
          })}
        </p>
      ) : null}
      <ul className={styles.list}>
        {rows.map((row) => {
          return (
            <li key={row.property.id} className={styles.card}>
              <p className={styles.cardTitle}>{row.property.name}</p>
              <Metric
                labelKey="client.carbon.scope2"
                value={row.carbon.scope2KgCO2e.value}
                unit="kgCO₂e"
                provenance={row.carbon.scope2KgCO2e.provenance}
                lastSeen={row.carbon.scope2KgCO2e.lastSeen}
              />
              <Metric
                labelKey="client.carbon.avoided"
                value={row.carbon.avoidedKgCO2e.value}
                unit="kgCO₂e"
                provenance={row.carbon.avoidedKgCO2e.provenance}
                lastSeen={row.carbon.avoidedKgCO2e.lastSeen}
              />
            </li>
          );
        })}
      </ul>
      <MockBoundary explanationKey="admin.mrv.registryMock">
        <div className={styles.choices}>
          <Button
            variant={first ? 'primary' : 'secondary'}
            pressed={first}
            onClick={() => {
              setFirst(true);
            }}
          >
            {t('admin.mrv.approve')}
          </Button>
          <Button
            variant={second ? 'primary' : 'ghost'}
            pressed={second}
            disabled={!first}
            onClick={() => {
              setSecond(true);
            }}
          >
            {t('admin.mrv.second')}
          </Button>
        </div>
        {first && !second ? <p role="status">{t('admin.mrv.firstApproved')}</p> : null}
        {first && second ? <p role="status">{t('admin.mrv.exported')}</p> : null}
      </MockBoundary>
    </div>
  );
}
