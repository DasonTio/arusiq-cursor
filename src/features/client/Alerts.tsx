/**
 * client.alerts — the household's one attention queue (D2 C-3). It replaces a
 * separate notification centre: there is one place a client looks to find out
 * what is asking for them.
 *
 * Needs action · watching · resolved, and inside each of those, grouped by
 * severity with grey as a band of its own rather than a rounding error. The
 * queue narrows by space and by part group. Every row carries its evidence,
 * its provenance and the delivery state of the notice that carried it —
 * MOCKED in 1A — plus exactly one action that resolves it, so no row is a
 * dead end.
 *
 * `?alert=` opens the whole alert inside this route: signals, thresholds, how
 * long the condition has run, confidence, likely cause, impact if ignored, and
 * the links to the unit and the space it concerns.
 *
 * @requirement FR-21 FR-22 FR-25
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { SEVERITY, type Severity } from '../../lib/domain/severity.ts';
import {
  PART_CATALOGUE,
  REFERENCE_NOW,
  links,
  simulatedTelemetry,
  walkRooms,
  walkUnits,
  type Alert,
  type AlertState,
  type PartGroup,
  type Property,
  type Room,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from './Alerts.module.css';

/** D2 C-3 — the three answers to "what must I do about this", in that order.
 *  Needs action leads because that is the decision this role owns. */
const QUEUES: readonly AlertState[] = ['needsAction', 'watching', 'resolved'];

/** Roll-up precedence (D7 §4.2). `unknown` sits above `normal` because a unit
 *  we cannot see may be the broken one — grey is never folded into green. */
const SEVERITY_ORDER: readonly Severity[] = [
  'critical',
  'warning',
  'unknown',
  'normal',
];

const PART_GROUPS: readonly PartGroup[] = ['indoor', 'outdoor', 'electrical'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The part group an alert implicates, or null for a tamper, data-quality or
 *  payment alert — those have no part and so belong to no group. */
const partGroupOf = (alert: Alert): PartGroup | null => {
  if (!alert.scope.partId) return null;
  const definition = PART_CATALOGUE.find((item) => {
    return item.id === alert.scope.partId;
  });
  return definition ? definition.group : null;
};

/** INV-GREY — a grey row never appears without a last-seen time, so this is
 *  the newest moment any evidence behind the alert was real. */
const lastSeenOf = (alert: Alert): string | null =>
  alert.evidence
    .map((item) => {
      return item.observed.lastSeen;
    })
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;

const newestHeartbeat = (properties: Property[]): string | null =>
  walkUnits(properties)
    .map((unit) => {
      return unit.device.lastHeartbeat;
    })
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;

/** Worst first, then most recent — the order an attention queue is read in. */
const sortAlerts = (alerts: Alert[]): Alert[] =>
  [...alerts].sort((a, b) => {
    const bySeverity = SEVERITY[b.severity].rank - SEVERITY[a.severity].rank;
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(b.raisedAt) - Date.parse(a.raisedAt);
  });

export default function Alerts() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const alertId = params.get('alert');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [alerts, setAlerts] = useState([] as Alert[]);
  const [properties, setProperties] = useState([] as Property[]);
  const [spaceId, setSpaceId] = useState(null as string | null);
  const [group, setGroup] = useState(null as PartGroup | null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    // INV-SCOPE — the adapter scopes the queue to this household; the screen
    // never filters somebody else's alerts out of a list it was handed.
    const scope = { role: session.role, userId: session.userId };
    void Promise.all([
      simulatedTelemetry.listAlerts(scope),
      simulatedTelemetry.listProperties(scope),
    ])
      .then(([nextAlerts, nextProperties]) => {
        if (cancelled) return;
        setAlerts(nextAlerts);
        setProperties(nextProperties);
        if (nextAlerts.length > 0) {
          setState('ready');
          return;
        }
        // D7 §18.3 — "nothing is wrong" and "we cannot see anything" are
        // different answers. A home where no unit is reporting is grey with a
        // last-seen time, never an empty queue.
        const units = walkUnits(nextProperties);
        const reporting = units.filter((unit) => {
          return unit.device.online;
        });
        setState(units.length > 0 && reporting.length === 0 ? 'noData' : 'empty');
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
  /** How long the condition has run, from the locale rather than from a
   *  sentence the screen assembles (D7 §6.5). */
  const formatDuration = (iso: string) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'unit',
      unit: 'day',
      unitDisplay: 'long',
      maximumFractionDigits: 0,
    }).format(Math.max(1, (Date.parse(REFERENCE_NOW) - Date.parse(iso)) / DAY_MS));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.alerts.title')}</h1>
        <p className={styles.stateBody}>{t('client.alerts.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.alerts.loading')}</p>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.alerts.title')}</h1>
        <p className={styles.stateBody}>{t('client.alerts.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.alerts.retry')}
        </Button>
      </section>
    );
  }

  const rooms = walkRooms(properties).map((entry) => {
    return entry.room;
  });

  // A link into the queue answers about the alert it names, whatever else the
  // queue holds — including when there is no such alert for this household.
  if (alertId) {
    const selected =
      alerts.find((item) => {
        return item.id === alertId;
      }) ?? null;
    if (!selected) {
      return (
        <section className={styles.state}>
          <h1 className={styles.stateTitle}>{t('client.alerts.title')}</h1>
          <p className={styles.stateBody}>{t('client.alerts.notFound')}</p>
          <Button variant="primary" to={links.alerts()}>
            {t('client.alerts.back')}
          </Button>
        </section>
      );
    }
    return (
      <AlertDetail
        alert={selected}
        rooms={rooms}
        format={format}
        formatDateTime={formatDateTime}
        formatDuration={formatDuration}
      />
    );
  }

  if (state === 'noData') {
    const heartbeat = newestHeartbeat(properties);
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.alerts.noDataTitle')}</h1>
        <SeverityIndicator severity="unknown" />
        <p className={styles.stateBody}>{t('client.alerts.noDataBody')}</p>
        <p className={styles.meta}>
          {heartbeat
            ? t('loadState.lastSeen', { time: formatDateTime(heartbeat) })
            : t('loadState.noData')}
        </p>
        <Button variant="primary" to="/spaces">
          {t('client.alerts.noDataAction')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.alerts.title')}</h1>
        <p className={styles.stateBody}>{t('client.alerts.empty')}</p>
        <Button variant="primary" to="/spaces">
          {t('client.alerts.emptyAction')}
        </Button>
      </section>
    );
  }

  const spaces = rooms.filter((room) => {
    return alerts.some((alert) => {
      return alert.scope.roomId === room.id;
    });
  });
  const visible = sortAlerts(
    alerts.filter((alert) => {
      if (spaceId !== null && alert.scope.roomId !== spaceId) return false;
      if (group !== null && partGroupOf(alert) !== group) return false;
      return true;
    }),
  );
  const clearFilters = () => {
    setSpaceId(null);
    setGroup(null);
  };

  return (
    <div className={styles.root}>
      <PageHeader titleKey="client.alerts.title" contextKey="client.alerts.purpose" />

      <section className={styles.filters} aria-labelledby="alerts-filters">
        <h2 className={styles.sectionTitle} id="alerts-filters">
          {t('client.alerts.filters')}
        </h2>
        <div className={styles.filterRow}>
          <p className={styles.filterLabel} id="alerts-filter-space">
            {t('client.alerts.spaceFilter')}
          </p>
          <div
            className={styles.choices}
            role="group"
            aria-labelledby="alerts-filter-space"
          >
            <Button
              variant={spaceId === null ? 'primary' : 'ghost'}
              pressed={spaceId === null}
              onClick={() => {
                setSpaceId(null);
              }}
            >
              {t('client.alerts.spaceAll')}
            </Button>
            {spaces.map((room) => {
              return (
                <Button
                  key={room.id}
                  variant={spaceId === room.id ? 'primary' : 'ghost'}
                  pressed={spaceId === room.id}
                  onClick={() => {
                    setSpaceId(room.id);
                  }}
                >
                  {room.name}
                </Button>
              );
            })}
          </div>
        </div>
        <div className={styles.filterRow}>
          <p className={styles.filterLabel} id="alerts-filter-group">
            {t('client.alerts.groupFilter')}
          </p>
          <div
            className={styles.choices}
            role="group"
            aria-labelledby="alerts-filter-group"
          >
            <Button
              variant={group === null ? 'primary' : 'ghost'}
              pressed={group === null}
              onClick={() => {
                setGroup(null);
              }}
            >
              {t('client.alerts.groupAll')}
            </Button>
            {PART_GROUPS.map((item) => {
              return (
                <Button
                  key={item}
                  variant={group === item ? 'primary' : 'ghost'}
                  pressed={group === item}
                  onClick={() => {
                    setGroup(item);
                  }}
                >
                  {t(`partGroup.${item}`)}
                </Button>
              );
            })}
          </div>
        </div>
        {spaceId !== null || group !== null ? (
          <Button variant="secondary" onClick={clearFilters}>
            {t('client.alerts.clearFilters')}
          </Button>
        ) : null}
      </section>

      {/* The way out of an over-narrowed queue is the Clear filters control in
          the panel above, so this panel states the result rather than
          repeating that button next to itself. */}
      {visible.length === 0 ? (
        <section className={styles.state}>
          <p className={styles.stateBody}>{t('client.alerts.noMatch')}</p>
        </section>
      ) : (
        <MockBoundary explanationKey="client.alerts.deliveryMock">
          <div className={styles.queues}>
            {QUEUES.map((queue) => {
              return (
                <Queue
                  key={queue}
                  queue={queue}
                  alerts={visible.filter((alert) => {
                    return alert.state === queue;
                  })}
                  rooms={rooms}
                  format={format}
                  formatDateTime={formatDateTime}
                />
              );
            })}
          </div>
        </MockBoundary>
      )}
    </div>
  );
}

function Queue({
  queue,
  alerts,
  rooms,
  format,
  formatDateTime,
}: {
  queue: AlertState;
  alerts: Alert[];
  rooms: Room[];
  format: (value: number) => string;
  formatDateTime: (iso: string) => string;
}) {
  const { t } = useTranslation();

  return (
    <section className={styles.queue} aria-labelledby={`alerts-queue-${queue}`}>
      <h2 className={styles.sectionTitle} id={`alerts-queue-${queue}`}>
        {t(`client.alerts.state.${queue}`)}
      </h2>
      {alerts.length === 0 ? (
        <p className={styles.meta}>{t('client.alerts.stateEmpty')}</p>
      ) : null}
      {SEVERITY_ORDER.map((severity) => {
        const banded = alerts.filter((alert) => {
          return alert.severity === severity;
        });
        if (banded.length === 0) return null;
        return (
          <div key={severity} className={styles.band}>
            <h3 className={styles.groupTitle}>
              {t('client.alerts.severityGroup', {
                severity: t(SEVERITY[severity].labelKey),
                count: format(banded.length),
              })}
            </h3>
            <ul className={styles.list}>
              {banded.map((alert) => {
                return (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    rooms={rooms}
                    formatDateTime={formatDateTime}
                  />
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function AlertRow({
  alert,
  rooms,
  formatDateTime,
}: {
  alert: Alert;
  rooms: Room[];
  formatDateTime: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const room = rooms.find((item) => {
    return item.id === alert.scope.roomId;
  });
  const unit = room?.units.find((item) => {
    return item.id === alert.scope.unitId;
  });
  const signal = alert.evidence[0] ?? null;
  const seen = lastSeenOf(alert);

  return (
    /* The ROW is the link, and it carries what the reader needs to triage:
       how bad, what, where, how far past the limit, when. Everything else —
       delivery, confidence, cause, impact and the action itself — is one
       click away in the detail, which already renders all of it. The board
       used to carry the whole alert record in twelve stacked label lines plus
       two buttons per card, on a screen whose job is deciding which of seven
       alerts to open first. */
    <li>
      <Link className={styles.row} to={links.alert(alert.id)}>
        <span className={styles.rowTop}>
          <SeverityIndicator severity={alert.severity} suspected={alert.suspected} />
          <span className={styles.rowTitle}>{t(alert.titleKey)}</span>
        </span>

        <span className={styles.chips}>
          {/* D7 §14.5 — tamper is critical, and a different category from a
              mechanical fault. It keeps its own label rather than dissolving
              into the maintenance queue. */}
          <span className={styles.chip}>{t(`alertCategory.${alert.category}`)}</span>
          {/* Only when true. "Confirmed" on every other card was a word that
              never varied, which is a word that carries nothing. */}
          {alert.suspected ? (
            <span className={styles.chip}>{t('client.alerts.suspected')}</span>
          ) : null}
        </span>

        {signal ? (
          /* The reading AND what it is measured against. Two bare figures
             side by side is a quiz: 9.24 and 8.5 mean nothing until one of
             them is named the limit. `Metric` keeps the name for assistive
             technology; the caption beside it is the sighted reader's copy,
             and is hidden from the accessibility tree so it is not read
             twice. */
          <span className={styles.reading}>
            <span className={styles.readingItem}>
              <span className={styles.readingLabel} aria-hidden="true">
                {t(signal.signalKey)}
              </span>
              <Metric
                compact
                labelKey={signal.signalKey}
                value={signal.observed.value}
                unit={signal.unit}
                provenance={signal.observed.provenance}
                lastSeen={signal.observed.lastSeen}
              />
            </span>
            <span className={styles.readingItem}>
              <span className={styles.readingLabel} aria-hidden="true">
                {t('client.alerts.limit')}
              </span>
              <Metric
                compact
                labelKey="client.alerts.limit"
                value={signal.threshold.value}
                unit={signal.unit}
                provenance={signal.threshold.provenance}
                lastSeen={signal.threshold.lastSeen}
              />
            </span>
          </span>
        ) : null}

        <span className={styles.where}>
          {[
            unit ? t('client.alerts.unitLine', { name: unit.name }) : null,
            room ? t('client.alerts.spaceLine', { name: room.name }) : null,
            t('client.alerts.raised', { time: formatDateTime(alert.raisedAt) }),
            // Grey is never a pass: it carries its last-seen time wherever it
            // appears, including here (INV-NO-FABRICATION).
            alert.severity === 'unknown'
              ? seen
                ? t('loadState.lastSeen', { time: formatDateTime(seen) })
                : t('loadState.noData')
              : null,
          ]
            .filter(Boolean)
            .map((line) => (
              <span key={line} className={styles.whereItem}>
                {line}
              </span>
            ))}
        </span>

        <span className={styles.rowHint}>{t(alert.recommendedAction.labelKey)}</span>
      </Link>
    </li>
  );
}

/**
 * D6 FR-22, MOCKED in 1A — "we sent it" and "they read it" are different
 * facts, so every channel carries its own state instead of one tick standing
 * for the whole notice.
 */
function Delivery({ alert }: { alert: Alert }) {
  const { t } = useTranslation();

  return (
    <div className={styles.delivery}>
      <p className={styles.meta}>{t('client.alerts.deliveryTitle')}</p>
      <ul className={styles.deliveryList}>
        {alert.delivery.map((notice) => {
          return (
            <li key={notice.channel} className={styles.meta}>
              {t('client.alerts.deliveryLine', {
                channel: t(`alertDelivery.channel.${notice.channel}`),
                state: t(`alertDelivery.state.${notice.state}`),
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * D6 FR-21 — the whole alert: signals, thresholds, how long the condition has
 * run, confidence, likely cause, impact if ignored, then one action. The order
 * is the same for every alert so a reader learns the shape once.
 */
function AlertDetail({
  alert,
  rooms,
  format,
  formatDateTime,
  formatDuration,
}: {
  alert: Alert;
  rooms: Room[];
  format: (value: number) => string;
  formatDateTime: (iso: string) => string;
  formatDuration: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const room = rooms.find((item) => {
    return item.id === alert.scope.roomId;
  });
  const unit = room?.units.find((item) => {
    return item.id === alert.scope.unitId;
  });
  const seen = lastSeenOf(alert);

  return (
    <div className={styles.root}>
      <Button variant="ghost" to={links.alerts()}>
        {t('client.alerts.back')}
      </Button>
      <PageHeader titleKey={alert.titleKey}>
        <SeverityIndicator severity={alert.severity} suspected={alert.suspected} />
      </PageHeader>
      <p className={styles.meta}>{t(`alertCategory.${alert.category}`)}</p>
      <p className={styles.meta}>
        {alert.suspected ? t('client.alerts.suspected') : t('client.alerts.confirmed')}
      </p>
      <p className={styles.meta}>
        {t('client.alerts.raised', { time: formatDateTime(alert.raisedAt) })}
      </p>
      {alert.severity === 'unknown' ? (
        <p className={styles.meta}>
          {seen
            ? t('loadState.lastSeen', { time: formatDateTime(seen) })
            : t('loadState.noData')}
        </p>
      ) : null}
      <ProvenanceChip provenance={alert.provenance} />

      <section className={styles.section} aria-labelledby="alert-signals">
        <h2 className={styles.sectionTitle} id="alert-signals">
          {t('client.alerts.signalsTitle')}
        </h2>
        {alert.evidence.map((signal) => {
          return (
            <div key={signal.signalKey} className={styles.evidence}>
              <div className={styles.metrics}>
                <Metric
                  labelKey={signal.signalKey}
                  value={signal.observed.value}
                  unit={signal.unit}
                  provenance={signal.observed.provenance}
                  lastSeen={signal.observed.lastSeen}
                />
                <Metric
                  labelKey="client.alerts.limit"
                  value={signal.threshold.value}
                  unit={signal.unit}
                  provenance={signal.threshold.provenance}
                  lastSeen={signal.threshold.lastSeen}
                />
              </div>
              <p className={styles.meta}>
                {t('client.alerts.since', { time: formatDateTime(signal.since) })}
              </p>
              <p className={styles.meta}>
                {t('client.alerts.duration', { value: formatDuration(signal.since) })}
              </p>
            </div>
          );
        })}
        <p className={styles.meta}>
          {t('client.alerts.confidence', { value: format(alert.confidence * 100) })}
        </p>
        {/* D6 FR-20 — a slow signal is reported as a projection with the band
            that makes it honest, never as a threshold breach. */}
        {alert.projection ? (
          <>
            <p className={styles.meta}>
              {t('client.alerts.projection', {
                by: formatDateTime(alert.projection.failureBy),
                earliest: formatDateTime(alert.projection.confidenceBand.earliest),
                latest: formatDateTime(alert.projection.confidenceBand.latest),
              })}
            </p>
            <ProvenanceChip provenance={alert.projection.provenance} />
          </>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="alert-cause">
        <h2 className={styles.sectionTitle} id="alert-cause">
          {t('client.alerts.causeTitle')}
        </h2>
        <p>{t(alert.likelyCauseKey)}</p>
        <h3 className={styles.groupTitle}>{t('client.alerts.impactTitle')}</h3>
        <p>{t(alert.impactIfIgnoredKey)}</p>
      </section>

      <MockBoundary explanationKey="client.alerts.deliveryMock">
        <section className={styles.section}>
          <Delivery alert={alert} />
        </section>
      </MockBoundary>

      <section className={styles.section} aria-labelledby="alert-action">
        <h2 className={styles.sectionTitle} id="alert-action">
          {t('client.alerts.actionTitle')}
        </h2>
        <Button variant="primary" to={alert.recommendedAction.href}>
          {t(alert.recommendedAction.labelKey)}
        </Button>
        {unit ? (
          <p className={styles.meta}>
            {t('client.alerts.unitLine', { name: unit.name })}
          </p>
        ) : null}
        {room ? (
          <p className={styles.meta}>
            {t('client.alerts.spaceLine', { name: room.name })}
          </p>
        ) : null}
        <div className={styles.actions}>
          {alert.scope.unitId ? (
            <Button variant="ghost" to={links.unit(alert.scope.unitId)}>
              {t('client.alerts.unitLink')}
            </Button>
          ) : null}
          {room ? (
            <Button variant="ghost" to={links.node(room.id)}>
              {t('client.alerts.spaceLink')}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
