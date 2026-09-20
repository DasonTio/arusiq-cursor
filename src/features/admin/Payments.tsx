/**
 * admin.payments — account standing and restriction rungs per site.
 *
 * @requirement FR-51 FR-52
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { restrictionSeverity } from '../../lib/domain/restriction.ts';
import {
  simulatedTelemetry,
  type AccountStanding,
  type Property,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';

export default function Payments() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [rows, setRows] = useState(
    [] as { property: Property; standing: AccountStanding }[],
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
    void simulatedTelemetry
      .listProperties(scope)
      .then(async (properties) => {
        const next = await Promise.all(
          properties.map(async (property) => {
            const standing = await simulatedTelemetry.getAccountStanding(
              scope,
              property.id,
            );
            return { property, standing };
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

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.payments.title')}</h1>
        <p className={styles.stateBody}>{t('admin.payments.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.payments.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.payments.title')}</h1>
        <p className={styles.stateBody}>{t('admin.payments.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.payments.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.payments.title')}</h1>
        <p className={styles.stateBody}>{t('admin.payments.empty')}</p>
      </section>
    );
  }

  return (
    <div className={styles.root}>
      <PageHeader titleKey="admin.payments.title" contextKey="admin.payments.purpose" />
      <MockBoundary explanationKey="admin.payments.mock">
        <ul className={styles.list}>
          {rows.map((row) => {
            const restriction = row.standing.restriction;
            return (
              <li key={row.property.id} className={styles.card}>
                <p className={styles.cardTitle}>{row.property.name}</p>
                <p>{t(`client.billing.state.${row.standing.state}`)}</p>
                <Metric
                  labelKey="client.billing.balance"
                  value={row.standing.balanceIdr.value}
                  unit="IDR"
                  provenance={row.standing.balanceIdr.provenance}
                  lastSeen={row.standing.balanceIdr.lastSeen}
                />
                <p className={styles.meta}>
                  {t('client.billing.due', {
                    time: formatDateTime(row.standing.dueAt),
                  })}
                </p>
                {restriction ? (
                  <>
                    <SeverityIndicator
                      severity={restrictionSeverity(restriction.step)}
                    />
                    <p>{t(`restriction.${restriction.step}`)}</p>
                    <p>{t(restriction.reasonKey)}</p>
                    <p className={styles.meta}>
                      {t('client.billing.restrictionApprovers', {
                        requester: restriction.approval.requester,
                        approver: restriction.approval.approver,
                        time: formatDateTime(restriction.approval.at),
                      })}
                    </p>
                    {/* ADR-0015 OD-02 — the rung-4 management sign-off. */}
                    {restriction.approval.signedOff ? (
                      <p className={styles.meta}>
                        {t('admin.approve.decidedSignedOff', {
                          name: restriction.approval.signedOff.manager,
                          time: formatDateTime(restriction.approval.signedOff.at),
                        })}
                      </p>
                    ) : null}
                    <Button
                      variant="ghost"
                      to={`/accounts/case?property=${encodeURIComponent(row.property.id)}`}
                    >
                      {t('admin.payments.openCase')}
                    </Button>
                  </>
                ) : (
                  <p>{t('client.billing.restrictionNone')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </MockBoundary>
    </div>
  );
}
