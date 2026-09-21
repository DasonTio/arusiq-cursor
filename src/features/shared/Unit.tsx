/**
 * shared.unit — all roles compose this object; they do not copy it.
 *
 * Now · Health · Control · Schedule · Energy · History. Indoor CO₂ and
 * kgCO₂e never share a section. A command stays put until Verified.
 *
 * @requirement FR-14 FR-15 FR-20 FR-40 FR-41 FR-65 FR-66
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { PartIcon } from '../../components/PartIcon.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { Textfield } from '../../components/Textfield.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import type { Role } from '../../lib/domain/role.ts';
import { restrictionSeverity } from '../../lib/domain/restriction.ts';
import {
  COMMAND_FLOW,
  commandStage,
  type CommandState,
} from '../../lib/domain/command.ts';
import {
  PART_CATALOGUE,
  REFERENCE_NOW,
  SIMULATED_POLICY,
  isAbsent,
  links,
  simulatedTelemetry,
  trailingPeriod,
  type Alert,
  type CarbonSummary,
  type EnergySeries,
  type MaintenanceEvent,
  type MaybeReading,
  type Part,
  type PartGroup,
  type Reading,
  type Unit as UnitRecord,
} from '../../lib/simulation/index.ts';
import { DataTable } from '../../patterns/DataTable.tsx';
import { FactStrip } from '../../patterns/FactStrip.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { TrendChart } from '../../patterns/TrendChart.tsx';
import { useSession } from '../auth/session.ts';
import styles from './Unit.module.css';

const GROUPS: readonly PartGroup[] = ['indoor', 'outdoor', 'electrical'];
const VIEWS = ['now', 'health', 'control', 'schedule', 'energy', 'history'] as const;
const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const MODES = ['cool', 'fan', 'eco', 'off'] as const;
const FANS = ['auto', '1', '2', '3'] as const;

type View = (typeof VIEWS)[number];
type Mode = (typeof MODES)[number];
type Fan = 1 | 2 | 3 | 'auto';

const readingOf = (input: MaybeReading): Reading => {
  if (isAbsent(input)) {
    return { value: null, provenance: 'simulated', lastSeen: null };
  }
  return input;
};

const treeHomeFor = (role: Role): string => {
  if (role === 'admin') return '/fleet';
  if (role === 'client') return '/spaces';
  return '/work';
};

const asView = (raw: string | null): View =>
  VIEWS.includes(raw as View) ? (raw as View) : 'now';

const parseFan = (raw: string): Fan => {
  if (raw === '1' || raw === '2' || raw === '3') return Number(raw) as Fan;
  return 'auto';
};

export default function Unit() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const unitId = params.get('node');
  const view = asView(params.get('view'));
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [unit, setUnit] = useState(null as UnitRecord | null);
  const [alerts, setAlerts] = useState([] as Alert[]);
  const [energy, setEnergy] = useState(null as EnergySeries | null);
  const [carbon, setCarbon] = useState(null as CarbonSummary | null);
  const [history, setHistory] = useState([] as MaintenanceEvent[]);
  const [retry, setRetry] = useState(0);
  const [draftMode, setDraftMode] = useState('cool' as Mode);
  const [draftSetpoint, setDraftSetpoint] = useState('25');
  const [draftFan, setDraftFan] = useState('auto' as Fan);
  const [confirming, setConfirming] = useState(false);
  const [commandState, setCommandState] = useState(null as CommandState | null);

  useEffect(() => {
    let cancelled = false;
    if (!session || !unitId) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    const period = trailingPeriod(new Date(REFERENCE_NOW), 30);
    void Promise.all([
      simulatedTelemetry.getUnit(scope, unitId),
      simulatedTelemetry.listAlerts(scope, { assetId: unitId }),
      simulatedTelemetry.getEnergy(scope, unitId, period),
      simulatedTelemetry.getCarbon(scope, unitId, period),
      simulatedTelemetry.listMaintenance(scope, { assetId: unitId }),
    ])
      .then(([nextUnit, nextAlerts, nextEnergy, nextCarbon, nextHistory]) => {
        if (cancelled) return;
        setUnit(nextUnit);
        setAlerts(nextAlerts);
        setEnergy(nextEnergy);
        setCarbon(nextCarbon);
        setHistory(nextHistory);
        if (nextUnit) {
          setDraftMode(nextUnit.control.mode);
          setDraftSetpoint(String(nextUnit.control.setpointC));
          setDraftFan(nextUnit.control.fanSpeed);
          setCommandState(nextUnit.control.lastCommand?.state ?? null);
          setState('ready');
        } else {
          setState('empty');
        }
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, unitId, retry]);

  /**
   * FR-40 — a command is not a toggle that flips. The pipeline is drawn by the
   * Control view; this is what makes it actually walk.
   *
   * It ticks explicitly rather than reading elapsed time, because
   * `simulatedTelemetry` runs on a fixed clock (`REFERENCE_NOW`) — simulated
   * time never moves in the browser, so a purely time-derived state would sit
   * on "Sent" forever. `advanceCommand` is the seam built for exactly this.
   * `failed` and `queued` are not rungs, so they are never scheduled.
   */
  useEffect(() => {
    if (!session || !unitId) return;
    if (commandState !== 'sent' && commandState !== 'acknowledged') return;
    const { acknowledgedAfterMs, verifiedAfterMs } = SIMULATED_POLICY.commandTimings;
    const delay =
      commandState === 'sent'
        ? acknowledgedAfterMs
        : verifiedAfterMs - acknowledgedAfterMs;
    const timer = setTimeout(() => {
      void simulatedTelemetry
        .advanceCommand({ role: session.role, userId: session.userId }, unitId)
        .then((next) => {
          if (!next) return;
          setCommandState(next.state);
          // D7 §13.1 — only `verified` settles the control into its new
          // position. `unit` is a clone taken at mount, so without re-reading
          // it the Current summary keeps showing the pre-command setpoint and
          // `dirty` stays true, offering Confirm again as though nothing
          // happened. Showing the rung light up is only half of FR-40.
          if (next.state === 'verified') setRetry((n) => n + 1);
        });
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [session, unitId, commandState]);

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
        <h1 className={styles.stateTitle}>{t('shared.unit.title')}</h1>
        <p className={styles.stateBody}>{t('shared.unit.error')}</p>
      </section>
    );
  }

  if (!unitId || state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('shared.unit.title')}</h1>
        <p className={styles.stateBody}>{t('shared.unit.empty')}</p>
        <Button variant="primary" to={treeHomeFor(session.role)}>
          {t('shared.unit.emptyAction')}
        </Button>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('shared.unit.loading')}</p>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error' || !unit) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('shared.unit.title')}</h1>
        <p className={styles.stateBody}>{t('shared.unit.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('shared.unit.retry')}
        </Button>
      </section>
    );
  }

  const hrefFor = (next: View) => {
    const home = treeHomeFor(session.role);
    return `${home}?node=${encodeURIComponent(unit.id)}&view=${next}`;
  };

  const temperature = readingOf(unit.live.temperatureC);
  const humidity = readingOf(unit.live.humidityPct);
  const energyToday = readingOf(unit.live.energyTodayKWh);
  const co2 = unit.live.co2Ppm;
  const pm = unit.live.pm25;
  const restriction = unit.restriction;
  const dirty =
    draftMode !== unit.control.mode ||
    Number(draftSetpoint) !== unit.control.setpointC ||
    draftFan !== unit.control.fanSpeed;
  const showEnergyChart = energy !== null && energy.actual.length >= 2;
  const toTrend = (points: readonly { t: string; kWh: number }[]) =>
    points.map((point) => ({ t: point.t, value: point.kWh }));
  // Totals come from the chart, over the days both series report.
  const energySummary = (totals: { lead: number; reference: number }) =>
    t('shared.unit.energyAlt', {
      actual: format(totals.lead),
      baseline: format(totals.reference),
    });

  const send = () => {
    const setpoint = Number(draftSetpoint);
    if (!Number.isFinite(setpoint)) return;
    void simulatedTelemetry
      .sendCommand({ role: session.role, userId: session.userId }, unit.id, {
        mode: draftMode,
        setpointC: setpoint,
        fanSpeed: draftFan,
      })
      .then((result) => {
        setCommandState(result.state);
        setConfirming(false);
      });
  };

  return (
    <div className={styles.root}>
      <Button variant="ghost" to={treeHomeFor(session.role)}>
        {t('shared.unit.back')}
      </Button>
      <PageHeader
        title={unit.name}
        contextKey="shared.unit.identity"
        contextValues={{ brand: unit.brand }}
      >
        <SeverityIndicator severity={unit.rollUp.severity} />
      </PageHeader>
      {/* The device's own state, as fields. It was four loose paragraphs
          under the heading — make, reporting state, last seen, and sometimes
          maintenance mode — which is the text-dump at the top of the one
          screen all three roles open. */}
      <FactStrip
        columns={3}
        fields={[
          {
            labelKey: 'shared.unit.deviceState',
            value: unit.device.online
              ? t('shared.unit.online')
              : t('shared.unit.offline'),
          },
          {
            labelKey: 'shared.unit.lastHeartbeat',
            value: unit.device.lastHeartbeat ? (
              <time dateTime={unit.device.lastHeartbeat}>
                {formatDateTime(unit.device.lastHeartbeat)}
              </time>
            ) : (
              t('loadState.noData')
            ),
          },
          ...(unit.device.maintenanceMode
            ? [
                {
                  labelKey: 'shared.unit.modeLabel' as const,
                  value: t('shared.unit.maintenanceMode'),
                },
              ]
            : []),
        ]}
      />

      {unit.device.tamperSuspected ? (
        <p className={styles.banner} role="status">
          {t('shared.unit.tamper')}
        </p>
      ) : null}

      {restriction ? (
        <section className={styles.banner}>
          <SeverityIndicator severity={restrictionSeverity(restriction.step)} />
          <h2 className={styles.bannerTitle}>{t('shared.unit.restrictionTitle')}</h2>
          <p>{t(`restriction.${restriction.step}`)}</p>
          <p className={styles.meta}>{t(restriction.reasonKey)}</p>
          <p className={styles.meta}>
            {t('shared.unit.restrictionGrace', {
              time: formatDateTime(restriction.graceEndsAt),
            })}
          </p>
          {restriction.healthSensitive ? (
            <p className={styles.meta}>{t('shared.unit.restrictionHealth')}</p>
          ) : null}
          {session.role === 'admin' ? (
            <p className={styles.meta}>
              {t('shared.unit.restrictionApproval', {
                requester: restriction.approval.requester,
                approver: restriction.approval.approver,
                time: formatDateTime(restriction.approval.at),
              })}
            </p>
          ) : null}
          <Button variant="secondary" to={links.billing()}>
            {t('shared.unit.pay')}
          </Button>
        </section>
      ) : null}

      <nav className={styles.views} aria-label={t('shell.views')}>
        {VIEWS.map((item) => (
          <Button
            key={item}
            variant={view === item ? 'primary' : 'ghost'}
            current={view === item}
            to={hrefFor(item)}
          >
            {t(`shared.unit.${item}`)}
          </Button>
        ))}
      </nav>

      {view === 'now' ? (
        <NowView
          temperature={temperature}
          humidity={humidity}
          energyToday={energyToday}
          co2={co2}
          pm={pm}
          control={unit.control}
          controlHref={hrefFor('control')}
          energyHref={hrefFor('energy')}
          format={format}
        />
      ) : null}

      {view === 'health' ? (
        <HealthView unit={unit} alerts={alerts} role={session.role} />
      ) : null}

      {view === 'control' ? (
        <section className={styles.section}>
          <p className={styles.meta}>{t('shared.unit.current')}</p>
          <p>
            {t('shared.unit.currentSummary', {
              mode: t(`controlMode.${unit.control.mode}`),
              setpoint: format(unit.control.setpointC),
              fan: t(`fanSpeed.${unit.control.fanSpeed}`),
            })}
          </p>
          {(commandState ?? unit.control.lastCommand?.state) ? (
            <CommandProgress
              state={commandState ?? unit.control.lastCommand?.state ?? 'sent'}
              at={unit.control.lastCommand?.at ?? null}
              formatDateTime={formatDateTime}
            />
          ) : null}
          {restriction ? (
            <p className={styles.meta}>{t('shared.unit.policyLimit')}</p>
          ) : null}
          <p>{t('shared.unit.mode')}</p>
          <div className={styles.choices}>
            {MODES.map((mode) => (
              <Button
                key={mode}
                variant={draftMode === mode ? 'primary' : 'ghost'}
                pressed={draftMode === mode}
                onClick={() => {
                  setDraftMode(mode);
                  setConfirming(false);
                }}
              >
                {t(`controlMode.${mode}`)}
              </Button>
            ))}
          </div>
          <Textfield
            id="unit-setpoint"
            labelKey="shared.unit.setpoint"
            helperKey="shared.unit.setpointHelper"
            value={draftSetpoint}
            onChange={setDraftSetpoint}
          />
          <p>{t('shared.unit.fan')}</p>
          <div className={styles.choices}>
            {FANS.map((fan) => (
              <Button
                key={fan}
                variant={String(draftFan) === fan ? 'primary' : 'ghost'}
                pressed={String(draftFan) === fan}
                onClick={() => {
                  setDraftFan(parseFan(fan));
                  setConfirming(false);
                }}
              >
                {t(`fanSpeed.${fan}`)}
              </Button>
            ))}
          </div>
          {dirty && !confirming ? (
            <Button
              variant="primary"
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t('shared.unit.confirm')}
            </Button>
          ) : null}
          {confirming ? (
            <div className={styles.card}>
              <p>
                {t('shared.unit.labelledValue', {
                  label: t('shared.unit.current'),
                  value: t('shared.unit.changeSummary', {
                    mode: t(`controlMode.${unit.control.mode}`),
                    setpoint: format(unit.control.setpointC),
                  }),
                })}
              </p>
              <p>
                {t('shared.unit.labelledValue', {
                  label: t('shared.unit.target'),
                  value: t('shared.unit.changeSummary', {
                    mode: t(`controlMode.${draftMode}`),
                    setpoint: format(Number(draftSetpoint)),
                  }),
                })}
              </p>
              <div className={styles.choices}>
                <Button variant="primary" onClick={send}>
                  {t('shared.unit.confirm')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraftMode(unit.control.mode);
                    setDraftSetpoint(String(unit.control.setpointC));
                    setDraftFan(unit.control.fanSpeed);
                    setConfirming(false);
                  }}
                >
                  {t('shared.unit.cancelChange')}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === 'schedule' ? (
        <section className={styles.section}>
          <p>{t('shared.unit.scheduleLead')}</p>
          {unit.device.online ? null : (
            <p className={styles.meta}>{t('shared.unit.offlineFallback')}</p>
          )}
          <ul className={styles.days}>
            {WEEKDAYS.map((day) => (
              <li key={day} className={styles.day}>
                <div className={styles.dayTop}>
                  <p className={styles.dayName}>{t(`weekday.${day}`)}</p>
                  <p>
                    {t('shared.unit.sameProgramme', {
                      mode: t(`controlMode.${unit.control.mode}`),
                      value: format(unit.control.setpointC),
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === 'energy' ? (
        <section className={styles.section}>
          {showEnergyChart ? (
            <TrendChart
              lead={toTrend(energy.actual)}
              reference={toTrend(energy.baseline)}
              accessibleName={energySummary}
              leadLabelKey="client.energy.actualSeries"
              referenceLabelKey="client.energy.baselineSeries"
              unit="kWh"
              partialFrom={energy.partialFrom}
            />
          ) : (
            <p className={styles.meta}>{t('loadState.noData')}</p>
          )}
          {energy ? (
            <>
              <ProvenanceChip provenance={energy.provenance} />
              <p className={styles.meta}>
                {t('shared.unit.completeness', {
                  value: format(energy.completeness * 100),
                })}
              </p>
              <Button variant="ghost" to={energy.method.href}>
                {t('shared.unit.methodLink')}
              </Button>
            </>
          ) : null}
          <h2 className={styles.sectionTitle}>{t('shared.unit.emissionsTitle')}</h2>
          {carbon ? (
            <>
              <p>
                {carbon.avoidedKgCO2e.value === null
                  ? t('loadState.noData')
                  : format(carbon.avoidedKgCO2e.value)}{' '}
                {t('shared.unit.heroUnit')}
              </p>
              <ProvenanceChip provenance={carbon.avoidedKgCO2e.provenance} />
              <p className={styles.meta}>
                {t('shared.unit.gridFactor', {
                  value: format(carbon.gridFactor.value),
                  source: carbon.gridFactor.source,
                  date: formatDate(carbon.gridFactor.effectiveFrom),
                })}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {view === 'history' ? (
        <section className={styles.section}>
          {history.length === 0 ? (
            <p>{t('shared.unit.noHistory')}</p>
          ) : (
            <ol className={styles.timeline}>
              {history.map((event) => (
                <li key={event.id} className={styles.card}>
                  <p className={styles.cardTitle}>{t(event.titleKey)}</p>
                  <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                  <Button variant="ghost" to={event.action.href}>
                    {t(event.action.labelKey)}
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <Button variant="secondary" to={links.serviceFor(session.role)}>
            {t('shared.unit.requestService')}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function NowView({
  temperature,
  humidity,
  energyToday,
  co2,
  pm,
  control,
  controlHref,
  energyHref,
  format,
}: {
  temperature: Reading;
  humidity: Reading;
  energyToday: Reading;
  co2: MaybeReading;
  pm: MaybeReading;
  control: UnitRecord['control'];
  controlHref: string;
  energyHref: string;
  format: (value: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.nowGrid}>
      <section className={styles.card} aria-labelledby="now-climate">
        <h2 className={styles.cardTitle} id="now-climate">
          {t('shared.unit.nowClimateCard')}
        </h2>
        <div className={styles.metrics}>
          <Metric
            labelKey="sensor.temperatureC"
            value={temperature.value}
            unit="°C"
            provenance={temperature.provenance}
            lastSeen={temperature.lastSeen}
          />
          <Metric
            labelKey="sensor.humidityPct"
            value={humidity.value}
            unit="%"
            provenance={humidity.provenance}
            lastSeen={humidity.lastSeen}
          />
        </div>
      </section>

      <section className={styles.card} aria-labelledby="now-controls">
        <h2 className={styles.cardTitle} id="now-controls">
          {t('shared.unit.nowControlsCard')}
        </h2>
        <p>
          {t('shared.unit.currentSummary', {
            mode: t(`controlMode.${control.mode}`),
            setpoint: format(control.setpointC),
            fan: t(`fanSpeed.${control.fanSpeed}`),
          })}
        </p>
        <Button variant="secondary" to={controlHref}>
          {t('shared.unit.adjust')}
        </Button>
      </section>

      <section className={styles.card} aria-labelledby="now-air">
        <h2 className={styles.cardTitle} id="now-air">
          {t('shared.unit.airTitle')}
        </h2>
        {isAbsent(co2) ? (
          <p className={styles.meta}>
            {t('shared.unit.absentSensor', {
              status: t('shared.unit.absent'),
              sensor: t('sensor.co2Ppm'),
            })}
          </p>
        ) : (
          <Metric
            labelKey="sensor.co2Ppm"
            value={readingOf(co2).value}
            unit="ppm"
            provenance={readingOf(co2).provenance}
            lastSeen={readingOf(co2).lastSeen}
          />
        )}
        {isAbsent(pm) ? (
          <p className={styles.meta}>
            {t('shared.unit.absentSensor', {
              status: t('shared.unit.absent'),
              sensor: t('sensor.pm25'),
            })}
          </p>
        ) : (
          <Metric
            labelKey="sensor.pm25"
            value={readingOf(pm).value}
            unit="µg/m³"
            provenance={readingOf(pm).provenance}
            lastSeen={readingOf(pm).lastSeen}
          />
        )}
      </section>

      <section className={styles.card} aria-labelledby="now-energy">
        <h2 className={styles.cardTitle} id="now-energy">
          {t('shared.unit.energy')}
        </h2>
        <Metric
          labelKey="sensor.energyTodayKWh"
          value={energyToday.value}
          unit="kWh"
          provenance={energyToday.provenance}
          lastSeen={energyToday.lastSeen}
        />
        <Button variant="ghost" to={energyHref}>
          {t('shared.unit.viewEnergy')}
        </Button>
      </section>
    </div>
  );
}

function HealthView({
  unit,
  alerts,
  role,
}: {
  unit: UnitRecord;
  alerts: Alert[];
  role: Role;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('shared.unit.partsTitle')}</h2>
      {GROUPS.map((group) => {
        const grouped: Part[] = unit.parts.filter((part) => part.group === group);
        return (
          <div key={group} className={styles.section}>
            <h3 className={styles.sectionTitle}>{t(`partGroup.${group}`)}</h3>
            {/* Twelve parts, each with the same four fields — a name, its
                readings, a verdict and one errand — drawn as twelve
                full-width cards with a button on each. Repeating fields are
                a table (§3), and this one is the technician's whole
                diagnostic surface. */}
            <DataTable
              captionKey="shared.unit.partsTitle"
              rows={grouped}
              rowKey={(part) => part.id}
              columns={[
                {
                  key: 'part',
                  labelKey: 'shared.unit.colPart',
                  rowHeader: true,
                  cell: (part) => (
                    <span className={styles.partIdentity}>
                      <PartIcon part={part.id} size={20} />
                      <span>{t(part.labelKey)}</span>
                    </span>
                  ),
                },
                {
                  key: 'readings',
                  labelKey: 'shared.unit.colReadings',
                  cell: (part) => <PartReadings part={part} />,
                },
                {
                  key: 'status',
                  labelKey: 'shared.unit.colStatus',
                  cell: (part) => (
                    <span className={styles.partStatus}>
                      <SeverityIndicator
                        severity={part.severity}
                        suspected={part.suspected}
                      />
                      {/* Only when it VARIES. "Confirmed by measurement" on
                          all twelve rows is a sentence that carries nothing;
                          `suspected` is the one that changes the reading. */}
                      {part.suspected ? (
                        <span className={styles.partMeta}>
                          {t('shared.unit.suspected')}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  labelKey: 'shared.unit.colAction',
                  nowrap: true,
                  cell: (part) => (
                    <PartAction part={part} alerts={alerts} role={role} />
                  ),
                },
              ]}
            />
          </div>
        );
      })}
    </section>
  );
}

/** Every signal the part declares, with its own name — a bare column of
 *  figures cannot be read, and the part name does not say which is which. */
function PartReadings({ part }: { part: Part }) {
  const { t } = useTranslation();
  return (
    <span className={styles.readings}>
      {part.signals.map((signal) => {
        const reading = readingOf(signal.reading);
        const shortKey = signal.key.split('.').at(-1);
        const partDef = PART_CATALOGUE.find((item) => item.id === part.id);
        const signalUnit = partDef?.signals.find((item) => item.key === shortKey)?.unit;
        return (
          /* Three bare figures under a column headed "Readings" is a quiz:
             0.99 A and 1.8 mm/s are a current and a vibration and nothing
             says which. `Metric` keeps the name for assistive technology;
             the caption is the sighted reader's copy and is hidden from the
             accessibility tree so it is not announced twice. */
          <span key={signal.key} className={styles.reading}>
            <span className={styles.partMeta} aria-hidden="true">
              {t(signal.key)}
            </span>
            <Metric
              compact
              labelKey={signal.key}
              value={reading.value}
              unit={signalUnit ?? ''}
              provenance={reading.provenance}
              lastSeen={reading.lastSeen}
            />
          </span>
        );
      })}
    </span>
  );
}

/** The errand differs per part — a filter is washed, a compressor opens its
 *  alert, everything else opens the service history — so it stays a link with
 *  its own words rather than becoming a chevron. */
function PartAction({
  part,
  alerts,
  role,
}: {
  part: Part;
  alerts: Alert[];
  role: Role;
}) {
  const { t } = useTranslation();
  const alert = alerts.find(
    (item) => item.scope.partId === part.id && item.state === 'needsAction',
  );
  const actionTo = alert?.recommendedAction.href ?? links.serviceFor(role);
  const actionKey =
    part.id === 'air-filter'
      ? 'shared.unit.filterAction'
      : alert
        ? 'shared.unit.partAction'
        : 'shared.unit.noAlert';
  return (
    <Link className={styles.partLink} to={actionTo}>
      {t(actionKey)}
    </Link>
  );
}

/** FR-40 — a command is not a toggle that flips. The pipeline shows
 *  Sent → Acknowledged → Verified with the current rung marked; `failed`
 *  breaks the pipeline (the unit did not move — stated, not implied) and
 *  `queued` holds the command with its time instead of dropping it. */
function CommandProgress({
  state,
  at,
  formatDateTime,
}: {
  state: CommandState;
  at: string | null;
  formatDateTime: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const { reached, terminal } = commandStage(state);
  const reachedIndex = COMMAND_FLOW.indexOf(reached);

  return (
    <div className={styles.commandLifecycle}>
      <ol className={styles.commandSteps} aria-label={t('shared.unit.commandSteps')}>
        {COMMAND_FLOW.map((flow, index) => {
          const broken = terminal === 'failed' && flow === 'verified';
          const className = [
            styles.commandStep,
            index <= reachedIndex ? styles.done : '',
            terminal === null && flow === reached ? styles.current : '',
            broken ? styles.broken : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={flow}
              className={className}
              aria-current={terminal === null && flow === reached ? 'step' : undefined}
            >
              {broken ? t('command.failed') : t(`command.${flow}`)}
            </li>
          );
        })}
      </ol>
      {terminal === 'failed' ? (
        <p className={styles.banner} role="alert">
          {t('shared.unit.commandFailed')}
        </p>
      ) : null}
      {/* A queued command says so whether or not it has a timestamp. The time
          used to gate the whole sentence, so the first command sent to a unit
          with no prior command — exactly the case where `lastCommand` is
          absent — showed a stalled pipeline and no reason for it. Missing is
          stated as missing; it does not delete the news. */}
      {terminal === 'queued' ? (
        <p className={styles.meta}>
          {at
            ? t('shared.unit.commandQueued', { time: formatDateTime(at) })
            : t('shared.unit.commandQueuedNoTime')}
        </p>
      ) : null}
    </div>
  );
}
