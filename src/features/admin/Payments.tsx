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
import { DataTable } from '../../patterns/DataTable.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';
import tableStyles from './Payments.module.css';

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
        <DataTable
          captionKey="admin.payments.purpose"
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
              key: 'standing',
              labelKey: 'admin.payments.colStanding',
              cell: (row) => t(`client.billing.state.${row.standing.state}`),
            },
            {
              key: 'balance',
              labelKey: 'admin.payments.colBalance',
              numeric: true,
              cell: (row) => (
                <Metric
                  compact
                  labelKey="client.billing.balance"
                  value={row.standing.balanceIdr.value}
                  unit="IDR"
                  provenance={row.standing.balanceIdr.provenance}
                  lastSeen={row.standing.balanceIdr.lastSeen}
                />
              ),
            },
            {
              key: 'due',
              labelKey: 'admin.payments.colDue',
              nowrap: true,
              cell: (row) => (
                <time dateTime={row.standing.dueAt}>
                  {formatDateTime(row.standing.dueAt)}
                </time>
              ),
            },
            {
              key: 'rung',
              labelKey: 'admin.payments.colRung',
              cell: (row) =>
                row.standing.restriction ? (
                  <span className={tableStyles.rung}>
                    <SeverityIndicator
                      severity={restrictionSeverity(row.standing.restriction.step)}
                    />
                    <span>{t(`restriction.${row.standing.restriction.step}`)}</span>
                  </span>
                ) : (
                  t('client.billing.restrictionNone')
                ),
            },
            {
              key: 'approvals',
              labelKey: 'admin.payments.colApprovals',
              cell: (row) => {
                const restriction = row.standing.restriction;
                if (!restriction) return t('workOrder.result.notApplicable');
                return (
                  <span className={tableStyles.approvals}>
                    <span>
                      {t('client.billing.restrictionApprovers', {
                        requester: restriction.approval.requester,
                        approver: restriction.approval.approver,
                        time: formatDateTime(restriction.approval.at),
                      })}
                    </span>
                    {/* ADR-0015 OD-02 — the rung-4 management sign-off. */}
                    {restriction.approval.signedOff ? (
                      <span>
                        {t('admin.approve.decidedSignedOff', {
                          name: restriction.approval.signedOff.manager,
                          time: formatDateTime(restriction.approval.signedOff.at),
                        })}
                      </span>
                    ) : null}
                  </span>
                );
              },
            },
            {
              key: 'action',
              labelKey: 'admin.payments.colAction',
              nowrap: true,
              cell: (row) =>
                row.standing.restriction ? (
                  <Button
                    variant="ghost"
                    to={`/accounts/case?property=${encodeURIComponent(row.property.id)}`}
                  >
                    {t('admin.payments.openCase')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </MockBoundary>
    </div>
  );
}
