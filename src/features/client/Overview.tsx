/**
 * client.overview — household Home.
 *
 * Greeting header with the property as context and the severity roll-up.
 * Dark hero: avoided emissions this month. Anything red or orange next.
 * Four KPI tiles, quick actions, comfort by room (Environment now),
 * energy sparkline, maintenance timeline.
 *
 * @requirement FR-10 FR-15 FR-61 FR-70
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Bell, ClipboardList, LineChart, Wallet } from 'lucide-react';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { SeverityRollUp } from '../../components/SeverityRollUp.tsx';
import { MetricGrid } from '../../patterns/MetricGrid.tsx';
import { Thermometer, TrendingDown, TriangleAlert, Zap } from 'lucide-react';
import { MetricTile } from '../../patterns/MetricTile.tsx';
import { TrendChart } from '../../patterns/TrendChart.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { QuickActions } from '../../patterns/QuickActions.tsx';
import { comfortLabelKey } from '../../lib/domain/comfort.ts';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  isAbsent,
  simulatedTelemetry,
  type ClientOverview,
  type MaybeReading,
  type Reading,
} from '../../lib/simulation/index.ts';
import { useSession } from '../auth/session.ts';
import styles from './Overview.module.css';

/** Greeting bucket for the local hour — the demo clock makes this stable. */
const greetingKey = (hour: number): string =>
  `client.overview.greeting.${
    hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  }`;

const readingOf = (input: MaybeReading): Reading => {
  if (isAbsent(input)) {
    return { value: null, provenance: 'simulated', lastSeen: null };
  }
  return input;
};

const toTrend = (points: readonly { t: string; kWh: number }[]) =>
  points.map((point) => ({ t: point.t, value: point.kWh }));

function Sparkline({ overview }: { overview: ClientOverview }) {
  const { t, i18n } = useTranslation();
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  // The summary is built from the totals TrendChart computes over the days
  // both series report, so it can no longer compare a whole baseline against
  // a partial meter.
  const summary = (totals: { lead: number; reference: number }) =>
    t('client.overview.sparklineAlt', {
      actual: format(totals.lead),
      baseline: format(totals.reference),
    });

  return (
    <TrendChart
      lead={toTrend(overview.energy.actual)}
      reference={toTrend(overview.energy.baseline)}
      accessibleName={summary}
      leadLabelKey="client.overview.actualSeries"
      referenceLabelKey="client.overview.baselineSeries"
    />
  );
}

export default function Overview() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [overview, setOverview] = useState(null as ClientOverview | null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    void simulatedTelemetry
      .getClientOverview({ role: session.role, userId: session.userId })
      .then((data: ClientOverview | null) => {
        if (cancelled) return;
        setOverview(data);
        setState(data ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.overview.title')}</h1>
        <p className={styles.stateBody}>{t('client.overview.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.overview.loading')}</p>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.overview.title')}</h1>
        <p className={styles.stateBody}>{t('client.overview.empty')}</p>
        <Button variant="primary" to="/spaces">
          {t('client.overview.emptyAction')}
        </Button>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.overview.title')}</h1>
        <p className={styles.stateBody}>{t('client.overview.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.overview.retry')}
        </Button>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.overview.noDataTitle')}</h1>
        <p className={styles.stateBody}>{t('client.overview.noDataBody')}</p>
      </section>
    );
  }

  const hero = overview.hero.avoidedKgCO2e;
  const savingPct = overview.kpis.savingVsNormal.pct;

  return (
    <div className={styles.root}>
      <PageHeader
        titleKey={greetingKey(new Date().getHours())}
        titleValues={{ name: session.name.split(' ')[0] ?? session.name }}
        context={overview.property.name}
      >
        <SeverityRollUp
          severity={overview.rollUp.severity}
          contributing={overview.rollUp.contributing}
          total={overview.rollUp.total}
          href="/spaces"
        />
      </PageHeader>

      <section className={styles.hero} aria-labelledby="home-hero-label">
        <p className={styles.heroLabel} id="home-hero-label">
          {t('client.overview.heroLabel')}
        </p>
        <p className={styles.heroValue}>
          <span className={styles.heroNumber}>
            {hero.value === null ? t('loadState.noData') : format(hero.value)}
          </span>
          {hero.value === null ? null : (
            <span className={styles.heroUnit}>{t('client.overview.heroUnit')}</span>
          )}
        </p>
        <ProvenanceChip provenance={hero.provenance} surface="inverse" />
        {hero.value === null && hero.lastSeen ? (
          <p className={styles.heroLabel}>
            {t('loadState.lastSeen', { time: formatDateTime(hero.lastSeen) })}
          </p>
        ) : null}
        <p className={styles.heroLabel}>
          {t('client.overview.gridFactor', {
            value: format(overview.hero.gridFactor.value),
            source: overview.hero.gridFactor.source,
            date: formatDate(overview.hero.gridFactor.effectiveFrom),
          })}
        </p>
        <p className={styles.heroLabel}>
          {t('client.overview.completeness', {
            value: format(overview.hero.completeness * 100),
          })}
        </p>
        <Button variant="secondary" to={overview.hero.method.href}>
          {t('client.overview.methodLink')}
        </Button>
        <Button variant="ghost" to="/insights/carbon">
          {t('client.overview.heroAction')}
        </Button>
      </section>

      {overview.attention.length > 0 ? (
        <section className={styles.section} aria-labelledby="home-attention">
          <h2 className={styles.sectionTitle} id="home-attention">
            {t('client.overview.attentionTitle')}
          </h2>
          <ul className={styles.attentionList}>
            {overview.attention.map((item) => (
              <li key={item.id} className={styles.attentionItem}>
                <div className={styles.attentionTop}>
                  <SeverityIndicator severity={item.severity} />
                  <p className={styles.attentionTitle}>{t(item.titleKey)}</p>
                </div>
                <p className={styles.attentionDetail}>{t(item.bodyKey)}</p>
                {item.dueAt ? (
                  <p className={styles.attentionDetail}>{formatDateTime(item.dueAt)}</p>
                ) : null}
                <Button variant="secondary" to={item.action.href}>
                  {t(item.action.labelKey)}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="home-kpis">
        <h2 className={styles.sectionTitle} id="home-kpis">
          {t('client.overview.summaryTitle')}
        </h2>
        <MetricGrid>
          <MetricTile icon={TriangleAlert} tone="warning">
            <Metric
              labelKey="client.overview.needsAttention"
              value={overview.rollUp.contributing}
              unit=""
              provenance="simulated"
            />
            <p className={styles.roomMeta}>
              {t('client.overview.roomStatus', {
                count: overview.rollUp.contributing,
                total: overview.rollUp.total,
              })}
            </p>
          </MetricTile>
          <MetricTile icon={Zap} tone="accent">
            <Metric
              labelKey="client.overview.energyToday"
              value={overview.kpis.energyToday.kWh.value}
              unit="kWh"
              provenance={overview.kpis.energyToday.kWh.provenance}
              lastSeen={overview.kpis.energyToday.kWh.lastSeen}
            />
            {overview.kpis.energyToday.reportingUnits <
            overview.kpis.energyToday.totalUnits ? (
              <p className={styles.roomMeta}>
                {t('client.overview.energyTodayCoverage', {
                  reporting: overview.kpis.energyToday.reportingUnits,
                  total: overview.kpis.energyToday.totalUnits,
                })}
              </p>
            ) : null}
          </MetricTile>
          <MetricTile icon={TrendingDown} tone="eco">
            <Metric
              labelKey="client.overview.savingVsNormal"
              value={overview.kpis.savingVsNormal.kWh.value}
              unit="kWh"
              provenance={overview.kpis.savingVsNormal.kWh.provenance}
              lastSeen={overview.kpis.savingVsNormal.kWh.lastSeen}
            />
            {savingPct.value !== null ? (
              <p className={styles.roomMeta}>
                {t('client.overview.savingPercent', { value: format(savingPct.value) })}
              </p>
            ) : null}
          </MetricTile>
          <MetricTile icon={Thermometer} tone="info">
            <Metric
              labelKey="client.overview.comfortableRooms"
              value={overview.kpis.comfort.comfortable}
              unit=""
              provenance={overview.kpis.comfort.provenance}
            />
            <p className={styles.roomMeta}>
              {t('client.overview.comfortCount', {
                comfortable: overview.kpis.comfort.comfortable,
                total: overview.kpis.comfort.total,
              })}
            </p>
            {overview.kpis.comfort.unknown > 0 ? (
              <p className={styles.roomMeta}>
                {t('client.overview.unknownRooms', {
                  count: overview.kpis.comfort.unknown,
                })}
              </p>
            ) : null}
          </MetricTile>
        </MetricGrid>
      </section>

      <section className={styles.section} aria-labelledby="home-quick-actions">
        <h2 className={styles.sectionTitle} id="home-quick-actions">
          {t('client.overview.quickActionsLabel')}
        </h2>
        <QuickActions
          ariaLabelKey="client.overview.quickActionsLabel"
          items={[
            {
              id: 'alerts',
              icon: Bell,
              labelKey: 'nav.client.alerts',
              to: '/alerts',
            },
            {
              id: 'request',
              icon: ClipboardList,
              labelKey: 'client.overview.quickActions.request',
              to: '/account/service?request=new',
            },
            {
              id: 'pay',
              icon: Wallet,
              labelKey: 'client.overview.quickActions.pay',
              to: '/account?pay=balance',
            },
            {
              id: 'insights',
              icon: LineChart,
              labelKey: 'nav.client.insights',
              to: '/insights',
            },
          ]}
        />
      </section>

      <section className={styles.section} aria-labelledby="home-rooms">
        <h2 className={styles.sectionTitle} id="home-rooms">
          {t('client.overview.environmentNow')}
        </h2>
        <ul className={styles.roomList}>
          {overview.rooms.map((room) => {
            const temperature = readingOf(room.temperatureC);
            const humidity = readingOf(room.humidityPct);
            return (
              <li key={room.roomId} className={styles.roomItem}>
                <div className={styles.roomTop}>
                  <div>
                    <p className={styles.roomName}>{room.name}</p>
                    <p className={styles.roomMeta}>
                      {room.floorNameKey ? t(room.floorNameKey) : room.floorName}
                    </p>
                    {room.healthSensitive ? (
                      <p className={styles.roomMeta}>
                        {t('client.overview.healthSensitive')}
                      </p>
                    ) : null}
                  </div>
                  <SeverityIndicator severity={room.comfortSeverity} />
                </div>
                <p>{t(comfortLabelKey(room.verdict))}</p>
                <div className={styles.roomEvidence}>
                  <Metric
                    labelKey="client.overview.temperature"
                    value={temperature.value}
                    unit="°C"
                    provenance={temperature.provenance}
                    lastSeen={temperature.lastSeen}
                  />
                  <Metric
                    labelKey="client.overview.humidity"
                    value={humidity.value}
                    unit="%"
                    provenance={humidity.provenance}
                    lastSeen={humidity.lastSeen}
                  />
                </div>
                {room.absentSensorKeys.length > 0 ? (
                  <div>
                    <p className={styles.roomMeta}>
                      {t('client.overview.absentSensors')}
                    </p>
                    <ul className={styles.legend}>
                      {room.absentSensorKeys.map((key) => (
                        <li key={key}>{t(key)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className={styles.roomMeta}>{t('client.overview.equipment')}</p>
                <SeverityRollUp
                  severity={room.equipment.severity}
                  contributing={room.equipment.contributing}
                  total={room.equipment.total}
                  href={room.href}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {overview.alerts.filter((a) => a.state === 'needsAction').length > 0 ? (
        <section className={styles.section} aria-labelledby="home-alerts">
          <h2 className={styles.sectionTitle} id="home-alerts">
            {t('client.overview.alertsTitle')}
          </h2>
          <ul className={styles.attentionList}>
            {overview.alerts
              .filter((a) => a.state === 'needsAction')
              .map((alert) => (
                <li key={alert.id} className={styles.attentionItem}>
                  <div className={styles.attentionTop}>
                    <SeverityIndicator
                      severity={alert.severity}
                      suspected={alert.suspected}
                    />
                    <p className={styles.attentionTitle}>{t(alert.titleKey)}</p>
                  </div>
                  <p className={styles.attentionDetail}>
                    {t(alert.impactIfIgnoredKey)}
                  </p>
                  <Button variant="secondary" to={alert.recommendedAction.href}>
                    {t(alert.recommendedAction.labelKey)}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="home-energy">
        <h2 className={styles.sectionTitle} id="home-energy">
          {t('client.overview.sparklineName')}
        </h2>
        <Sparkline overview={overview} />
        <ProvenanceChip provenance={overview.energy.provenance} />
        <Button variant="ghost" to={overview.energy.method.href}>
          {t('client.overview.methodLink')}
        </Button>
      </section>

      <section className={styles.section} aria-labelledby="home-service">
        <h2 className={styles.sectionTitle} id="home-service">
          {t('client.overview.maintenanceTitle')}
        </h2>
        <ol className={styles.timeline}>
          {/* Chronological, because it is a timeline. The adapter returns
              these in record order, which put September before August and a
              2027 warranty expiry in the middle of last month's visits. */}
          {[...overview.maintenance]
            .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
            .map((event) => (
              <li key={event.id}>
                {/* The row is the link. Twelve events each carrying their own
                  button was twelve times the weight of one column of rows,
                  and gave no sense of sequence at all. The action label is
                  kept as a hint because it is the state cue — "See completed
                  work" and "Review the proposal" are not the same event. */}
                <Link className={styles.timelineLink} to={event.action.href}>
                  <time className={styles.timelineWhen} dateTime={event.at}>
                    {formatDate(event.at)}
                  </time>
                  <span className={styles.timelineRail} aria-hidden="true">
                    <span className={styles.timelineDot} />
                  </span>
                  <span className={styles.timelineBody}>
                    <span className={styles.timelineTitle}>{t(event.titleKey)}</span>
                    <span className={styles.timelineWho}>
                      {event.technician ? event.technician.name : t('loadState.noData')}
                    </span>
                    <span className={styles.timelineHint}>
                      {t(event.action.labelKey)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
