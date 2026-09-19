/**
 * admin.alerts — HQ attention queue. Evidence and delivery stay on the alert.
 *
 * @requirement FR-21 FR-22
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { SEVERITY, type Severity } from '../../lib/domain/severity.ts';
import { links, simulatedTelemetry, type Alert } from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList, type PriorityGroup } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { ADMIN_OVERVIEW_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from '../shared/Screen.module.css';

const ORDER: readonly Severity[] = ['critical', 'warning', 'unknown', 'normal'];

export default function Alerts() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const alertId = params.get('alert');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [alerts, setAlerts] = useState([] as Alert[]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    void simulatedTelemetry
      .listAlerts({ role: session.role, userId: session.userId })
      .then((next) => {
        if (cancelled) return;
        setAlerts(next);
        setState(next.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value);

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.alerts.title')}</h1>
        <p className={styles.stateBody}>{t('admin.alerts.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.alerts.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.alerts.title')}</h1>
        <p className={styles.stateBody}>{t('admin.alerts.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.alerts.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.alerts.title')}</h1>
        <p className={styles.stateBody}>{t('admin.alerts.empty')}</p>
      </section>
    );
  }

  const selected = alertId ? alerts.find((item) => item.id === alertId) : null;
  const sorted = [...alerts].sort(
    (a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank,
  );

  if (alertId && !selected) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.alerts.title')}</h1>
        <p>{t('client.alerts.notFound')}</p>
        <Button variant="primary" to="/overview/events">
          {t('client.alerts.back')}
        </Button>
      </section>
    );
  }

  if (selected) {
    return (
      <div className={styles.root}>
        <Button variant="ghost" to="/overview/events">
          {t('client.alerts.back')}
        </Button>
        <h1>{t(selected.titleKey)}</h1>
        <SeverityIndicator
          severity={selected.severity}
          suspected={selected.suspected}
        />
        <p>{t(selected.likelyCauseKey)}</p>
        <p>{t(selected.impactIfIgnoredKey)}</p>
        <ProvenanceChip provenance={selected.provenance} />
        {/* INV-NO-DEAD-END. `recommendedAction.href` is authored for the
            CLIENT — every category resolves to /account/service, /account or
            /spaces, all of which catalog.ts restricts to `client`. Rendering
            it raw sent HQ to "not available for your role" from every row on
            this queue. HQ's equivalent of "act on this" is its own service
            board; payment-category alerts belong on Accounts. */}
        <Button
          variant="primary"
          to={
            selected.category === 'payment'
              ? '/accounts'
              : links.serviceFor(session.role)
          }
        >
          {t(selected.recommendedAction.labelKey)}
        </Button>
      </div>
    );
  }

  const groups: PriorityGroup[] = ORDER.filter((severity) => {
    return sorted.some((alert) => alert.severity === severity);
  }).map((severity) => ({
    id: severity,
    labelKey: 'client.alerts.severityGroup',
    labelValues: {
      severity: t(`severity.${severity}`),
      count: format(sorted.filter((alert) => alert.severity === severity).length),
    },
    items: sorted
      .filter((alert) => alert.severity === severity)
      .map((alert) => ({
        id: alert.id,
        titleKey: alert.titleKey,
        detailKey: `alertCategory.${alert.category}`,
        severity: alert.severity,
        suspected: alert.suspected,
        to: `/overview/events?alert=${encodeURIComponent(alert.id)}`,
      })),
  }));

  return (
    <div className={styles.root}>
      <ViewTabs items={ADMIN_OVERVIEW_VIEWS} />
      <PageHeader titleKey="admin.alerts.title" contextKey="admin.alerts.purpose" />
      <SectionHeader titleKey="admin.alerts.listTitle" />
      <PriorityList ariaLabelKey="admin.alerts.title" groups={groups} />
    </div>
  );
}
