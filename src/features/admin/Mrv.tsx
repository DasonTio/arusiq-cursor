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
import { DataTable } from '../../patterns/DataTable.tsx';
import { FactStrip } from '../../patterns/FactStrip.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { ADMIN_REPORTING_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from '../shared/Screen.module.css';
import mrv from './Mrv.module.css';

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
      {/* D6 FR-70 — the factor every figure below was multiplied by. It was a
          grey sentence floating above them, as it was on `client.carbon`. */}
      {factor ? (
        <div className={mrv.factorPanel}>
          <FactStrip
            columns={3}
            fields={[
              {
                labelKey: 'client.carbon.gridFactorLabel',
                value: t('client.carbon.gridFactorValue', {
                  value: format(factor.value),
                }),
              },
              { labelKey: 'client.carbon.sourceLabel', value: factor.source },
              {
                labelKey: 'client.carbon.fromLabel',
                value: (
                  <time dateTime={factor.effectiveFrom}>
                    {formatDate(factor.effectiveFrom)}
                  </time>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {/* Two sites carrying the same two figures is a comparison, and a card
          each puts them side by side without aligning them. A table does. */}
      <DataTable
        captionKey="admin.mrv.title"
        rows={rows}
        rowKey={(row) => row.property.id}
        columns={[
          {
            key: 'site',
            labelKey: 'admin.payments.colSite',
            rowHeader: true,
            nowrap: true,
            cell: (row) => row.property.name,
          },
          {
            key: 'scope2',
            labelKey: 'client.carbon.scope2',
            numeric: true,
            cell: (row) => (
              <Metric
                compact
                labelKey="client.carbon.scope2"
                value={row.carbon.scope2KgCO2e.value}
                unit="kgCO₂e"
                provenance={row.carbon.scope2KgCO2e.provenance}
                lastSeen={row.carbon.scope2KgCO2e.lastSeen}
              />
            ),
          },
          {
            key: 'avoided',
            labelKey: 'client.carbon.avoided',
            numeric: true,
            cell: (row) => (
              <Metric
                compact
                labelKey="client.carbon.avoided"
                value={row.carbon.avoidedKgCO2e.value}
                unit="kgCO₂e"
                provenance={row.carbon.avoidedKgCO2e.provenance}
                lastSeen={row.carbon.avoidedKgCO2e.lastSeen}
              />
            ),
          },
        ]}
      />
      <MockBoundary explanationKey="admin.mrv.registryMock">
        {/* Dual approval is a SEQUENCE, and it was two buttons with the
            second one disabled — the reader could see that something was
            unavailable but not that they were at step one of two, nor what
            the second step was waiting for. Same failure the restriction
            ladder exists to prevent: a two-person control drawn as a pair of
            switches (D7 §13.2). */}
        <section className={mrv.approval} aria-labelledby="mrv-approval">
          <h2 className={mrv.approvalTitle} id="mrv-approval">
            {t('admin.mrv.approvalTitle')}
          </h2>
          <ol className={mrv.steps}>
            <li className={first ? `${mrv.step} ${mrv.done}` : mrv.step}>
              <span className={mrv.marker} aria-hidden="true">
                {new Intl.NumberFormat(i18n.language).format(1)}
              </span>
              <span className={mrv.stepBody}>
                <span className={mrv.stepName}>{t('admin.mrv.stepOne')}</span>
                <span className={mrv.stepState}>
                  {first ? t('admin.mrv.stateRecorded') : t('admin.mrv.stateAwaiting')}
                </span>
              </span>
              {first ? null : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFirst(true);
                  }}
                >
                  {t('admin.mrv.approve')}
                </Button>
              )}
            </li>
            <li
              className={[mrv.step, second ? mrv.done : '', first ? '' : mrv.blocked]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={mrv.marker} aria-hidden="true">
                {new Intl.NumberFormat(i18n.language).format(2)}
              </span>
              <span className={mrv.stepBody}>
                <span className={mrv.stepName}>{t('admin.mrv.stepTwo')}</span>
                <span className={mrv.stepState}>
                  {second
                    ? t('admin.mrv.stateRecorded')
                    : first
                      ? t('admin.mrv.stateAwaiting')
                      : t('admin.mrv.stateBlocked')}
                </span>
              </span>
              {/* Present and disabled, not absent. A control that appears
                  when a condition is met leaves the reader wondering whether
                  they missed it; a disabled one with its reason stated beside
                  it tells them what has to happen first. */}
              {second ? null : (
                <Button
                  variant="secondary"
                  disabled={!first}
                  onClick={() => {
                    setSecond(true);
                  }}
                >
                  {t('admin.mrv.second')}
                </Button>
              )}
            </li>
          </ol>
          {first && !second ? (
            <p className={mrv.result} role="status">
              {t('admin.mrv.firstApproved')}
            </p>
          ) : null}
          {first && second ? (
            <p className={mrv.result} role="status">
              {t('admin.mrv.exported')}
            </p>
          ) : null}
        </section>
      </MockBoundary>
    </div>
  );
}
