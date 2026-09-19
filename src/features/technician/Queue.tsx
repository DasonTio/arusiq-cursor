/**
 * tech.queue — assigned work, ordered by critical, then SLA, then age.
 *
 * On a wide viewport Today · Week · Silent sit side by side. Opening a row
 * composes the shared work-order object (ADR-0008).
 *
 * @requirement FR-11 FR-32 FR-34 FR-83
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  REFERENCE_NOW,
  simulatedTelemetry,
  walkUnits,
  type Unit,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import { MetricGrid } from '../../patterns/MetricGrid.tsx';
import { MetricTile } from '../../patterns/MetricTile.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList, type PriorityGroup } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { useSession } from '../auth/session.ts';
import WorkOrder from '../shared/WorkOrder.tsx';
import styles from './Queue.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_RANK = { urgent: 0, high: 1, routine: 2 } as const;

const sortOrders = (orders: WorkOrderSummary[]): WorkOrderSummary[] => {
  return [...orders].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    const bySla = Date.parse(a.slaDueAt) - Date.parse(b.slaDueAt);
    if (bySla !== 0) return bySla;
    return Date.parse(a.openedAt) - Date.parse(b.openedAt);
  });
};

const isSilent = (order: WorkOrderSummary, units: Unit[]): boolean => {
  if (!order.scope.unitId) return false;
  const unit = units.find((item) => item.id === order.scope.unitId);
  return unit ? !unit.device.online : false;
};

export default function Queue() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [orders, setOrders] = useState([] as WorkOrderSummary[]);
  const [units, setUnits] = useState([] as Unit[]);
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
      simulatedTelemetry.listWorkOrders(scope),
      simulatedTelemetry.listProperties(scope),
    ])
      .then(([nextOrders, properties]) => {
        if (cancelled) return;
        setOrders(sortOrders(nextOrders));
        setUnits(walkUnits(properties));
        setState(nextOrders.length === 0 ? 'empty' : 'ready');
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
        <h1 className={styles.stateTitle}>{t('tech.queue.title')}</h1>
        <p className={styles.stateBody}>{t('tech.queue.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('tech.queue.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('tech.queue.title')}</h1>
        <p className={styles.stateBody}>{t('tech.queue.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('tech.queue.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('tech.queue.title')}</h1>
        <p className={styles.stateBody}>{t('tech.queue.empty')}</p>
      </section>
    );
  }

  const now = Date.parse(REFERENCE_NOW);
  const silent = orders.filter((order) => {
    return isSilent(order, units);
  });
  const rest = orders.filter((order) => {
    return !isSilent(order, units);
  });
  const today = rest.filter((order) => {
    return Date.parse(order.slaDueAt) - now < DAY_MS;
  });
  const week = rest.filter((order) => {
    return Date.parse(order.slaDueAt) - now >= DAY_MS;
  });
  const critical = orders.filter((order) => {
    return order.severity === 'critical';
  });

  const groupFor = (label: string, bucket: WorkOrderSummary[]): PriorityGroup => ({
    id: label,
    labelKey: `tech.queue.${label}`,
    items: bucket.map((order) => ({
      id: order.id,
      titleKey: order.titleKey,
      detail: order.unitName ?? undefined,
      severity: order.severity,
      to: order.action.href,
    })),
  });

  return (
    <div className={styles.root}>
      <PageHeader titleKey="tech.queue.title" contextKey="tech.queue.purpose" />
      <MetricGrid>
        <MetricTile>
          <Metric
            labelKey="tech.queue.critical"
            value={critical.length}
            unit=""
            provenance="simulated"
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="tech.queue.today"
            value={today.length}
            unit=""
            provenance="simulated"
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="tech.queue.week"
            value={week.length}
            unit=""
            provenance="simulated"
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="tech.queue.silent"
            value={silent.length}
            unit=""
            provenance="simulated"
          />
        </MetricTile>
      </MetricGrid>
      <SectionHeader titleKey="tech.queue.listTitle" />
      <PriorityList
        ariaLabelKey="tech.queue.title"
        groups={[
          groupFor('today', today),
          groupFor('week', week),
          groupFor('silent', silent),
        ]}
      />
    </div>
  );
}
