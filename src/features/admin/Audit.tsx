/**
 * admin.audit — append-only slice reconstructed from the simulated record.
 *
 * @requirement FR-102
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { simulatedTelemetry, walkUnits } from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';

interface AuditRow {
  id: string;
  at: string;
  text: string;
}

export default function Audit() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [rows, setRows] = useState([] as AuditRow[]);
  const [exported, setExported] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    void Promise.all([
      simulatedTelemetry.listProperties(scope),
      simulatedTelemetry.listWorkOrders(scope),
    ])
      .then(([properties, orders]) => {
        if (cancelled) return;
        const next: AuditRow[] = [];
        walkUnits(properties).forEach((unit) => {
          if (unit.restriction) {
            next.push({
              id: `restriction-${unit.id}`,
              at: unit.restriction.approval.at,
              text: t('admin.audit.rowRestriction', {
                step: t(`restriction.${unit.restriction.step}`),
                requester: unit.restriction.approval.requester,
                approver: unit.restriction.approval.approver,
              }),
            });
          }
          if (unit.control.lastCommand) {
            next.push({
              id: `command-${unit.id}`,
              at: unit.control.lastCommand.at,
              text: t('admin.audit.rowCommand', {
                unit: unit.name,
                state: t(`command.${unit.control.lastCommand.state}`),
              }),
            });
          }
        });
        orders.forEach((order) => {
          next.push({
            id: `visit-${order.id}`,
            at: order.openedAt,
            text: t('admin.audit.rowVisit', {
              title: t(order.titleKey),
              state: t(`workOrder.state.${order.state}`),
            }),
          });
        });
        next.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        setRows(next);
        setState(next.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry, t]);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.audit.title')}</h1>
        <p className={styles.stateBody}>{t('admin.audit.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.audit.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.audit.title')}</h1>
        <p className={styles.stateBody}>{t('admin.audit.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.audit.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.audit.title')}</h1>
        <p className={styles.stateBody}>{t('admin.audit.empty')}</p>
      </section>
    );
  }

  return (
    <div className={styles.root}>
      <PageHeader titleKey="admin.audit.title" contextKey="admin.audit.purpose" />
      <ul className={styles.list}>
        {rows.map((row) => {
          return (
            <li key={row.id} className={styles.card}>
              <p className={styles.cardTitle}>{row.text}</p>
              <p className={styles.meta}>{formatDateTime(row.at)}</p>
            </li>
          );
        })}
      </ul>
      <MockBoundary explanationKey="admin.audit.exportMock">
        <Button
          variant="secondary"
          onClick={() => {
            setExported(true);
          }}
        >
          {t('admin.audit.export')}
        </Button>
        {exported ? <p>{t('admin.audit.exportMock')}</p> : null}
      </MockBoundary>
    </div>
  );
}
