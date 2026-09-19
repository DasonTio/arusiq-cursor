/**
 * tech.me — this week's assigned work, language and sign-out.
 *
 * @requirement FR-04 FR-11
 */
import { useEffect, useState } from 'react';
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
import { useSession } from '../auth/session.ts';
import { LanguageSwitch } from '../shared/LanguageSwitch.tsx';
import { SessionActions } from '../shared/Profile.tsx';
import styles from '../shared/Screen.module.css';

export default function Me() {
  const { t } = useTranslation();
  const { session } = useSession();
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

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('tech.me.title')}</h1>
        <p className={styles.stateBody}>{t('tech.me.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('tech.me.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('tech.me.title')}</h1>
        <p className={styles.stateBody}>{t('tech.me.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('tech.me.retry')}
        </Button>
      </section>
    );
  }

  const open = orders.filter((order) => order.state !== 'closed');
  const closed = orders.filter((order) => order.state === 'closed');
  const groupFor = (
    id: string,
    labelKey: string,
    bucket: WorkOrderSummary[],
  ): PriorityGroup => ({
    id,
    labelKey,
    items: bucket.map((order) => ({
      id: order.id,
      titleKey: order.titleKey,
      severity: order.severity,
      suspected: order.suspected,
      to: order.action.href,
    })),
  });
  const groups: PriorityGroup[] = [];
  if (open.length > 0) {
    groups.push(groupFor('open', 'tech.me.open', open));
  }
  if (closed.length > 0) {
    groups.push(groupFor('closed', 'tech.me.closed', closed));
  }

  return (
    <div className={styles.root}>
      <PageHeader titleKey="tech.me.title" contextKey="tech.me.purpose">
        <p className={styles.meta}>{session.name}</p>
      </PageHeader>
      <LanguageSwitch />
      <SectionHeader titleKey="tech.me.weekTitle" />
      {state === 'empty' ? (
        <p>{t('tech.me.empty')}</p>
      ) : (
        <PriorityList ariaLabelKey="tech.me.weekTitle" groups={groups} />
      )}
      <SessionActions />
    </div>
  );
}
