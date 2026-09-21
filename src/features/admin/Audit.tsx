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
import { DataTable } from '../../patterns/DataTable.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';

/**
 * One audit row, as four FIELDS rather than one sentence.
 *
 * The screen drew twenty-three identical cards in two columns, so the
 * chronology zig-zagged left-right-left down the page and the only way to
 * compare two events was to read both sentences in full. Same fields on every
 * row means a table (§3), and a table needs the fields apart.
 */
interface AuditRow {
  id: string;
  at: string;
  kindKey: string;
  subject: string;
  detail: string;
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
              kindKey: 'admin.audit.kindRestriction',
              subject: t(`restriction.${unit.restriction.step}`),
              // ADR-0015 OD-02 — rung 4 carries a third signature. An audit
              // row that shows two of three signatures is not an audit row.
              detail: unit.restriction.approval.signedOff
                ? t('admin.audit.detailSignedOff', {
                    requester: unit.restriction.approval.requester,
                    approver: unit.restriction.approval.approver,
                    manager: unit.restriction.approval.signedOff.manager,
                  })
                : t('admin.audit.detailApproval', {
                    requester: unit.restriction.approval.requester,
                    approver: unit.restriction.approval.approver,
                  }),
            });
          }
          if (unit.control.lastCommand) {
            next.push({
              id: `command-${unit.id}`,
              at: unit.control.lastCommand.at,
              kindKey: 'admin.audit.kindCommand',
              subject: unit.name,
              detail: t(`command.${unit.control.lastCommand.state}`),
            });
          }
        });
        orders.forEach((order) => {
          next.push({
            id: `visit-${order.id}`,
            at: order.openedAt,
            kindKey: 'admin.audit.kindVisit',
            subject: t(order.titleKey),
            detail: t(`workOrder.state.${order.state}`),
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
      {/* Newest first, in ONE column. Two columns of cards made the reader
          scan left-right-left down a list whose whole meaning is its order. */}
      <DataTable
        captionKey="admin.audit.title"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'at',
            labelKey: 'admin.audit.colWhen',
            rowHeader: true,
            nowrap: true,
            cell: (row) => <time dateTime={row.at}>{formatDateTime(row.at)}</time>,
          },
          {
            key: 'kind',
            labelKey: 'admin.audit.colKind',
            cell: (row) => t(row.kindKey),
          },
          {
            key: 'subject',
            labelKey: 'admin.audit.colSubject',
            cell: (row) => row.subject,
          },
          {
            key: 'detail',
            labelKey: 'admin.audit.colDetail',
            cell: (row) => row.detail,
          },
        ]}
      />
      <MockBoundary explanationKey="admin.audit.exportMock">
        <div className={styles.choices}>
          <Button
            variant="secondary"
            onClick={() => {
              setExported(true);
            }}
          >
            {t('admin.audit.export')}
          </Button>
          {exported ? <p>{t('admin.audit.exportMock')}</p> : null}
        </div>
      </MockBoundary>
    </div>
  );
}
