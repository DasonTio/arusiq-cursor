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
        <div className={tableStyles.panel}>
          <table className={tableStyles.table}>
            <caption className="sr-only">{t('admin.payments.purpose')}</caption>
            <thead className={tableStyles.head}>
              <tr>
                <th scope="col">{t('admin.payments.colSite')}</th>
                <th scope="col">{t('admin.payments.colStanding')}</th>
                <th scope="col" className={tableStyles.numeric}>
                  {t('admin.payments.colBalance')}
                </th>
                <th scope="col" className={tableStyles.numeric}>
                  {t('admin.payments.colDue')}
                </th>
                <th scope="col">{t('admin.payments.colRung')}</th>
                <th scope="col">{t('admin.payments.colApprovals')}</th>
                <th scope="col">{t('admin.payments.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const restriction = row.standing.restriction;
                return (
                  <tr key={row.property.id}>
                    <th scope="row" className={tableStyles.site}>
                      {row.property.name}
                    </th>
                    <td data-label={t('admin.payments.colStanding')}>
                      {t(`client.billing.state.${row.standing.state}`)}
                    </td>
                    <td
                      data-label={t('admin.payments.colBalance')}
                      className={tableStyles.numeric}
                    >
                      <Metric
                        labelKey="client.billing.balance"
                        value={row.standing.balanceIdr.value}
                        unit="IDR"
                        provenance={row.standing.balanceIdr.provenance}
                        lastSeen={row.standing.balanceIdr.lastSeen}
                      />
                    </td>
                    <td
                      data-label={t('admin.payments.colDue')}
                      className={tableStyles.numeric}
                    >
                      <time dateTime={row.standing.dueAt}>
                        {formatDateTime(row.standing.dueAt)}
                      </time>
                    </td>
                    <td data-label={t('admin.payments.colRung')}>
                      {restriction ? (
                        <span className={tableStyles.rung}>
                          <SeverityIndicator
                            severity={restrictionSeverity(restriction.step)}
                          />
                          <span>{t(`restriction.${restriction.step}`)}</span>
                        </span>
                      ) : (
                        t('client.billing.restrictionNone')
                      )}
                    </td>
                    <td
                      data-label={t('admin.payments.colApprovals')}
                      className={tableStyles.approvals}
                    >
                      {restriction ? (
                        <>
                          <p>
                            {t('client.billing.restrictionApprovers', {
                              requester: restriction.approval.requester,
                              approver: restriction.approval.approver,
                              time: formatDateTime(restriction.approval.at),
                            })}
                          </p>
                          {/* ADR-0015 OD-02 — the rung-4 management sign-off. */}
                          {restriction.approval.signedOff ? (
                            <p>
                              {t('admin.approve.decidedSignedOff', {
                                name: restriction.approval.signedOff.manager,
                                time: formatDateTime(restriction.approval.signedOff.at),
                              })}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        t('workOrder.result.notApplicable')
                      )}
                    </td>
                    <td>
                      {restriction ? (
                        <Button
                          variant="ghost"
                          to={`/accounts/case?property=${encodeURIComponent(row.property.id)}`}
                        >
                          {t('admin.payments.openCase')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </MockBoundary>
    </div>
  );
}
