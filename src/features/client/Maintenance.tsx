/**
 * client.maintenance — visits the household can track. Opening a visit
 * composes the shared work-order object; requests are not raised from a menu.
 *
 * @requirement FR-30 FR-32 FR-33
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  simulatedTelemetry,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList, type PriorityGroup } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { ACCOUNT_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import ServiceRequest from '../shared/ServiceRequest.tsx';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import WorkOrder from '../shared/WorkOrder.tsx';
import styles from './Maintenance.module.css';

export default function Maintenance() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const eventId = params.get('event');
  const request = params.get('request');
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
        setOrders(next);
        setState(next.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  if (eventId) {
    return <WorkOrder />;
  }
  if (request === 'new') {
    return <ServiceRequest />;
  }

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.maintenance.title')}</h1>
        <p className={styles.stateBody}>{t('client.maintenance.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.maintenance.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.maintenance.title')}</h1>
        <p className={styles.stateBody}>{t('client.maintenance.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.maintenance.retry')}
        </Button>
      </section>
    );
  }

  const group: PriorityGroup = {
    id: 'visits',
    labelKey: 'client.maintenance.listTitle',
    items: orders.map((order) => ({
      id: order.id,
      titleKey: order.titleKey,
      detail: order.unitName ?? undefined,
      severity: order.severity,
      suspected: order.suspected,
      statusKey: `workOrder.state.${order.state}`,
      to: order.action.href,
    })),
  };

  return (
    <div className={styles.root}>
      <ViewTabs items={ACCOUNT_VIEWS} />
      <PageHeader
        titleKey="client.maintenance.title"
        contextKey="client.maintenance.purpose"
      />
      {state === 'empty' ? (
        <section className={styles.state}>
          <p className={styles.stateBody}>{t('client.maintenance.empty')}</p>
          <Button variant="primary" to="/alerts">
            {t('client.maintenance.emptyAction')}
          </Button>
        </section>
      ) : (
        <>
          <SectionHeader titleKey="client.maintenance.timelineTitle" />
          <PriorityList ariaLabelKey="client.maintenance.title" groups={[group]} />
        </>
      )}
    </div>
  );
}
