/**
 * tech.map — travel order of assigned sites. A geographic map is not drawn
 * (D7 §20 gap 3); the list is the route.
 *
 * @requirement FR-11
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  simulatedTelemetry,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { useSession } from '../auth/session.ts';
import WorkOrder from '../shared/WorkOrder.tsx';
import styles from '../shared/Screen.module.css';

const PRIORITY_RANK = { urgent: 0, high: 1, routine: 2 } as const;

const byTravel = (orders: WorkOrderSummary[]): WorkOrderSummary[] => {
  return [...orders].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    return Date.parse(a.slaDueAt) - Date.parse(b.slaDueAt);
  });
};

export default function Map() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const orderId = params.get('order');
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
        const open = next.filter((item) => item.state !== 'closed');
        setOrders(byTravel(open));
        setState(open.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  if (orderId) return <WorkOrder />;

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('tech.map.title')}</h1>
        <p className={styles.stateBody}>{t('tech.map.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('tech.map.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('tech.map.title')}</h1>
        <p className={styles.stateBody}>{t('tech.map.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('tech.map.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('tech.map.title')}</h1>
        <p className={styles.stateBody}>{t('tech.map.empty')}</p>
        <Button variant="primary" to="/work">
          {t('tech.map.emptyAction')}
        </Button>
      </section>
    );
  }

  return (
    <div className={styles.root}>
      <PageHeader titleKey="tech.map.title" contextKey="tech.map.purpose" />
      <MockBoundary explanationKey="tech.map.mapMock">
        <SectionHeader titleKey="tech.map.scheduleTitle" />
        <PriorityList
          ordered
          ariaLabelKey="tech.map.title"
          groups={[
            {
              id: 'route',
              labelKey: 'tech.map.routeTitle',
              items: orders.map((order) => ({
                id: order.id,
                titleKey: order.titleKey,
                detail: order.unitName ?? undefined,
                severity: order.severity,
                suspected: order.suspected,
                statusKey: 'tech.map.window',
                statusValues: { time: formatDateTime(order.slaDueAt) },
                to: order.action.href,
              })),
            },
          ]}
        />
      </MockBoundary>
    </div>
  );
}
