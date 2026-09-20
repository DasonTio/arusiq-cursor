/**
 * admin.overview — decisions first, portfolio glance second.
 *
 * @requirement FR-12 FR-52
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { restrictionSeverity } from '../../lib/domain/restriction.ts';
import type { Severity } from '../../lib/domain/severity.ts';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  REFERENCE_NOW,
  simulatedTelemetry,
  trailingPeriod,
  walkUnits,
  type AccountStanding,
  type Alert,
  type EnergySeries,
  type Property,
  type RestrictionRequest,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import { MetricGrid } from '../../patterns/MetricGrid.tsx';
import { Lock, TriangleAlert, Wallet, Wrench } from 'lucide-react';
import { MetricTile } from '../../patterns/MetricTile.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList, type PriorityGroup } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { ADMIN_OVERVIEW_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import {
  MRV_COMPLETENESS_THRESHOLD,
  portfolioCompleteness,
} from './portfolioCompleteness.ts';
import styles from '../shared/Screen.module.css';

/** No severity field travels on an account standing row directly; this
 *  derives one honestly from the data the row already carries — the
 *  restriction ladder's own severity map, or `warning` for a plain overdue
 *  balance (unwelcome, not yet an emergency — D7 §13.2's own scale). */
const accountSeverity = (standing: AccountStanding): Severity =>
  standing.restriction ? restrictionSeverity(standing.restriction.step) : 'warning';

export default function Overview() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [alerts, setAlerts] = useState([] as Alert[]);
  const [orders, setOrders] = useState([] as WorkOrderSummary[]);
  const [accounts, setAccounts] = useState(
    [] as { property: Property; standing: AccountStanding }[],
  );
  const [energy, setEnergy] = useState(
    [] as { property: Property; series: EnergySeries }[],
  );
  const [approvals, setApprovals] = useState([] as RestrictionRequest[]);
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
      simulatedTelemetry.listAlerts(scope),
      simulatedTelemetry.listWorkOrders(scope),
      simulatedTelemetry.listProperties(scope),
      simulatedTelemetry.listRestrictionRequests(scope, { state: 'pending' }),
    ])
      .then(async ([nextAlerts, nextOrders, properties, nextApprovals]) => {
        const standings = await Promise.all(
          properties.map(async (property) => {
            const standing = await simulatedTelemetry.getAccountStanding(
              scope,
              property.id,
            );
            return { property, standing };
          }),
        );
        // Every site, not just the first one. This section is headed
        // "Portfolio glance" and used to show `properties[0]`'s completeness
        // under it — one site's figure standing in for the whole estate, and
        // a reader has no way to tell which site they are looking at.
        const period = trailingPeriod(new Date(REFERENCE_NOW), 30);
        const series = await Promise.all(
          properties.map(async (property) => ({
            property,
            series: await simulatedTelemetry.getEnergy(scope, property.id, period),
          })),
        );
        if (cancelled) return;
        setAlerts(nextAlerts);
        setOrders(nextOrders);
        setAccounts(standings);
        setApprovals(nextApprovals);
        setEnergy(series);
        setState('ready');
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
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.overview.title')}</h1>
        <p className={styles.stateBody}>{t('admin.overview.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.overview.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.overview.title')}</h1>
        <p className={styles.stateBody}>{t('admin.overview.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.overview.retry')}
        </Button>
      </section>
    );
  }

  const portfolio = portfolioCompleteness(energy);
  const unassigned = orders.filter((order) => {
    return !order.assignedTo && order.state !== 'closed';
  });
  const critical = alerts.filter((alert) => {
    return alert.severity === 'critical' && alert.state === 'needsAction';
  });
  const overdue = accounts.filter((row) => {
    return row.standing.state === 'overdue';
  });
  const restricted = accounts.filter((row) => {
    return row.standing.restriction !== null;
  });
  const silent = walkUnits(
    accounts.map((row) => {
      return row.property;
    }),
  ).filter((unit) => {
    return !unit.device.online;
  });
  // The most recent heartbeat among the silent units — the "last seen" the
  // grey state is required to carry. `null` when none of them ever reported,
  // which is a different sentence, not a missing one.
  const lastHeardFrom = silent
    .map((unit) => unit.device.lastHeartbeat)
    .filter((at): at is string => at !== null)
    .sort()
    .at(-1);

  const priorityGroups: PriorityGroup[] = [
    // First on purpose: an approval lapses if nobody answers it (FR-52), and
    // this screen is called Decisions needed.
    {
      id: 'approvals',
      labelKey: 'admin.approve.queueTitle',
      items: approvals.map((item) => ({
        id: item.id,
        title: item.spaceName,
        detail: item.propertyName,
        severity: restrictionSeverity(item.requestedStep),
        statusKey: `restriction.${item.requestedStep}`,
        to: `/accounts/approve?request=${encodeURIComponent(item.id)}`,
      })),
    },
    {
      id: 'unassigned',
      labelKey: 'admin.overview.unassigned',
      items: unassigned.map((order) => ({
        id: order.id,
        titleKey: order.titleKey,
        severity: order.severity,
        to: '/service',
      })),
    },
    {
      id: 'critical',
      labelKey: 'admin.overview.critical',
      items: critical.map((alert) => ({
        id: alert.id,
        titleKey: alert.titleKey,
        severity: alert.severity,
        to: '/overview/events',
      })),
    },
    {
      id: 'overdue',
      labelKey: 'admin.overview.overdue',
      items: overdue.map((row) => ({
        id: row.property.id,
        title: row.property.name,
        severity: accountSeverity(row.standing),
        to: '/accounts',
      })),
    },
    {
      id: 'restrictions',
      labelKey: 'admin.overview.restrictions',
      items: restricted.map((row) => ({
        id: row.property.id,
        title: row.property.name,
        severity: accountSeverity(row.standing),
        statusKey: row.standing.restriction
          ? `restriction.${row.standing.restriction.step}`
          : undefined,
        to: `/accounts/case?property=${encodeURIComponent(row.property.id)}`,
      })),
    },
  ];

  return (
    <div className={styles.root}>
      <ViewTabs items={ADMIN_OVERVIEW_VIEWS} />
      <PageHeader titleKey="admin.overview.title" contextKey="admin.overview.purpose" />
      <MetricGrid>
        <MetricTile icon={Wrench} tone="accent">
          <Metric
            labelKey="admin.overview.kpi.unassigned"
            value={unassigned.length}
            unit=""
            provenance="simulated"
          />
          <p className={styles.meta}>{t('admin.overview.kpi.unassignedCaption')}</p>
        </MetricTile>
        <MetricTile icon={TriangleAlert} tone="critical">
          <Metric
            labelKey="admin.overview.kpi.critical"
            value={critical.length}
            unit=""
            provenance="simulated"
          />
          <p className={styles.meta}>{t('admin.overview.kpi.criticalCaption')}</p>
        </MetricTile>
        <MetricTile icon={Wallet} tone="warning">
          <Metric
            labelKey="admin.overview.kpi.overdue"
            value={overdue.length}
            unit=""
            provenance="simulated"
          />
          <p className={styles.meta}>{t('admin.overview.kpi.overdueCaption')}</p>
        </MetricTile>
        <MetricTile icon={Lock} tone="warning">
          <Metric
            labelKey="admin.overview.kpi.restricted"
            value={restricted.length}
            unit=""
            provenance="simulated"
          />
          <p className={styles.meta}>{t('admin.overview.kpi.restrictedCaption')}</p>
        </MetricTile>
      </MetricGrid>
      <SectionHeader titleKey="admin.overview.listTitle" />
      <PriorityList groups={priorityGroups} ariaLabelKey="admin.overview.title" />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('admin.overview.portfolio')}</h2>
        {portfolio ? (
          <>
            <p className={`${styles.meta} ${styles.statusLine}`}>
              {t('admin.overview.completenessAcross', {
                value: format(portfolio.completeness * 100),
                count: energy.length,
              })}
              {/* INV-AGGREGATE — an aggregate inherits the weakest provenance
                  of its inputs, and it says so beside the figure. */}
              <ProvenanceChip provenance={portfolio.provenance} />
            </p>
            {/* D6 FR-71 draws a line below which a derived package is only
                provisional. A portfolio mean can sit above that line while a
                site sits under it, so the site is named, not averaged away. */}
            {portfolio.weakest ? (
              <p className={styles.meta}>
                {t('admin.overview.completenessWeakest', {
                  name: portfolio.weakest.property.name,
                  value: format(portfolio.weakest.series.completeness * 100),
                  threshold: format(MRV_COMPLETENESS_THRESHOLD * 100),
                })}
              </p>
            ) : null}
          </>
        ) : null}
        {/* "Grey is not a pass": a silent unit is stated as silent, with how
            many and when one was last heard from. This was a bare "No data"
            under the portfolio figure — no subject, no last-seen and nothing
            to do about it, which is the one shape this rule forbids. */}
        {silent.length > 0 ? (
          <p className={`${styles.meta} ${styles.statusLine}`}>
            <SeverityIndicator severity="unknown" />
            {lastHeardFrom
              ? t('admin.overview.silentUnits', {
                  count: silent.length,
                  time: formatDateTime(lastHeardFrom),
                })
              : t('admin.overview.silentUnitsNeverReported', {
                  count: silent.length,
                })}
          </p>
        ) : null}
        <Button variant="ghost" to="/reporting">
          {t('nav.admin.energy')}
        </Button>
      </section>
    </div>
  );
}
