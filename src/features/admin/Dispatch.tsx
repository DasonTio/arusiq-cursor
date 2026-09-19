/**
 * admin.dispatch — board by state and SLA. Opening a row composes the shared
 * work-order object; third-party scope is already applied on the adapter.
 *
 * @requirement FR-31 FR-34 FR-32
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  simulatedTelemetry,
  type WorkOrderAssignee,
  type WorkOrderState,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList, type PriorityGroup } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { useSession } from '../auth/session.ts';
import Assign from '../shared/Assign.tsx';
import WorkOrder from '../shared/WorkOrder.tsx';
import styles from './Dispatch.module.css';

const STATES: readonly WorkOrderState[] = [
  'dispatched',
  'accepted',
  'inProgress',
  'awaitingVerification',
  'reopened',
  'closed',
  'escalated',
];

const PRIORITY_RANK = { urgent: 0, high: 1, routine: 2 } as const;

const sortOrders = (orders: WorkOrderSummary[]): WorkOrderSummary[] => {
  return [...orders].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    return Date.parse(a.slaDueAt) - Date.parse(b.slaDueAt);
  });
};

export default function Dispatch() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const assignId = params.get('assign');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [orders, setOrders] = useState([] as WorkOrderSummary[]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    void simulatedTelemetry
      .listWorkOrders({ role: session.role, userId: session.userId })
      .then((next) => {
        if (cancelled) return;
        setOrders(sortOrders(next));
        setState(next.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  if (orderId) return <WorkOrder />;

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.dispatch.title')}</h1>
        <p className={styles.stateBody}>{t('admin.dispatch.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.dispatch.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.dispatch.title')}</h1>
        <p className={styles.stateBody}>{t('admin.dispatch.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.dispatch.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.dispatch.title')}</h1>
        <p className={styles.stateBody}>{t('admin.dispatch.empty')}</p>
      </section>
    );
  }

  const assignment = assignId
    ? orders.find((candidate) => candidate.id === assignId)
    : null;
  if (assignment) {
    return (
      <Assign
        order={assignment}
        onAssigned={(assignee: WorkOrderAssignee) => {
          setOrders((current) =>
            current.map((candidate) =>
              candidate.id === assignment.id
                ? { ...candidate, assignedTo: assignee }
                : candidate,
            ),
          );
        }}
      />
    );
  }

  const unassigned = orders.filter((order) => {
    return order.assignedTo === null;
  });

  const groups: PriorityGroup[] = STATES.filter((bucket) => {
    return orders.some((order) => order.state === bucket);
  }).map((bucket) => ({
    id: bucket,
    labelKey: `workOrder.state.${bucket}`,
    items: orders
      .filter((order) => order.state === bucket)
      .map((order) => ({
        id: order.id,
        titleKey: order.titleKey,
        detail: order.unitName ?? undefined,
        severity: order.severity,
        suspected: order.suspected,
        statusKey:
          order.assignedTo === null ? 'admin.dispatch.needsAssignee' : undefined,
        to:
          order.assignedTo === null
            ? `/service?assign=${encodeURIComponent(order.id)}`
            : order.action.href,
      })),
  }));

  return (
    <div className={styles.root}>
      <PageHeader titleKey="admin.dispatch.title" contextKey="admin.dispatch.purpose" />
      {unassigned.length > 0 ? (
        <p className={styles.meta}>
          {t('admin.dispatch.unassigned', { count: String(unassigned.length) })}
        </p>
      ) : null}
      <SectionHeader titleKey="admin.dispatch.listTitle" />
      <PriorityList ariaLabelKey="admin.dispatch.title" groups={groups} />
    </div>
  );
}
