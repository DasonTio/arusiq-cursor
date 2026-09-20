/**
 * client.energy — power, kWh, tariff cost, and saving versus the adjusted
 * baseline. The chart always carries a link to shared.method.
 *
 * @requirement FR-60 FR-61 FR-62
 */
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { weakestProvenance } from '../../lib/domain/provenance.ts';
import {
  REFERENCE_NOW,
  TARIFF,
  asReading,
  isAbsent,
  links,
  savingVsBaseline,
  simulatedTelemetry,
  trailingPeriod,
  walkRooms,
  walkUnits,
  type EnergySeries,
  type Property,
  type Reading,
  type Unit,
} from '../../lib/simulation/index.ts';
import { MetricGrid } from '../../patterns/MetricGrid.tsx';
import { CalendarDays, Wallet, Zap } from 'lucide-react';
import { MetricTile } from '../../patterns/MetricTile.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { INSIGHT_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import { MethodPanel } from '../shared/Method.tsx';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from './Energy.module.css';

const LEVER_HREF: Record<string, string> = {
  eco: '/spaces',
  setpoint: '/spaces',
  schedule: '/spaces',
  occupancy: '/spaces',
  filterCleaning: '/alerts',
};

const sumReadings = (readings: Reading[]): Reading => {
  if (readings.length === 0 || readings.some((item) => item.value === null)) {
    const seen =
      readings.map((item) => item.lastSeen).find((iso) => iso !== null) ?? null;
    return {
      value: null,
      provenance: readings[0]?.provenance ?? 'simulated',
      lastSeen: seen,
    };
  }
  return {
    value: readings.reduce((sum, item) => {
      if (item.value === null) return sum;
      return sum + item.value;
    }, 0),
    provenance: weakestProvenance(readings.map((item) => item.provenance)),
    lastSeen: readings.at(-1)?.lastSeen ?? null,
  };
};

const costOf = (kWh: Reading): Reading => ({
  value: kWh.value === null ? null : Math.round(kWh.value * TARIFF.idrPerKWh),
  provenance: kWh.provenance,
  lastSeen: kWh.lastSeen,
});

const lastDayKWh = (series: EnergySeries): Reading => {
  const last = series.actual.at(-1);
  return {
    value: last ? last.kWh : null,
    provenance: series.provenance,
    lastSeen: last?.t ?? null,
  };
};

const periodKWh = (series: EnergySeries): Reading => {
  if (series.actual.length === 0) {
    return { value: null, provenance: series.provenance, lastSeen: null };
  }
  return {
    value: series.actual.reduce((sum, point) => sum + point.kWh, 0),
    provenance: series.provenance,
    lastSeen: series.actual.at(-1)?.t ?? null,
  };
};

export default function Energy() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const days = params.get('days') === '7' ? 7 : 30;
  const showMethod = params.get('method') !== null;
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [home, setHome] = useState(null as Property | null);
  const [series, setSeries] = useState(null as EnergySeries | null);
  const [units, setUnits] = useState([] as Unit[]);
  const [rooms, setRooms] = useState(
    [] as { roomName: string; series: EnergySeries }[],
  );
  const [unitRows, setUnitRows] = useState(
    [] as { unit: Unit; series: EnergySeries }[],
  );
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    const period = trailingPeriod(new Date(REFERENCE_NOW), days);
    void simulatedTelemetry
      .listProperties(scope)
      .then(async (properties) => {
        const property = properties[0] ?? null;
        if (!property) {
          if (!cancelled) {
            setHome(null);
            setState('empty');
          }
          return;
        }
        const walked = walkUnits([property]);
        const roomWalk = walkRooms([property]);
        const [homeSeries, unitSeriesList, roomSeriesList] = await Promise.all([
          simulatedTelemetry.getEnergy(scope, property.id, period),
          Promise.all(
            walked.map((unit) => simulatedTelemetry.getEnergy(scope, unit.id, period)),
          ),
          Promise.all(
            roomWalk.map((entry) =>
              simulatedTelemetry.getEnergy(scope, entry.room.id, period),
            ),
          ),
        ]);
        if (cancelled) return;
        setHome(property);
        setSeries(homeSeries);
        setUnits(walked);
        setUnitRows(
          walked.map((unit, index) => {
            return { unit, series: unitSeriesList[index] };
          }),
        );
        setRooms(
          roomWalk.map((entry, index) => {
            return { roomName: entry.room.name, series: roomSeriesList[index] };
          }),
        );
        const silent = walked.length > 0 && walked.every((unit) => !unit.device.online);
        if (silent && homeSeries.actual.length === 0) {
          setState('noData');
          return;
        }
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry, days]);

  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  const formatIdr = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);

  if (showMethod) {
    return (
      <div className={styles.root}>
        <ViewTabs items={INSIGHT_VIEWS} />
        <MethodPanel backTo={`/insights?days=${days}`} />
      </div>
    );
  }

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.energy.title')}</h1>
        <p className={styles.stateBody}>{t('client.energy.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.energy.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.energy.title')}</h1>
        <p className={styles.stateBody}>{t('client.energy.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.energy.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty' || !home || !series) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.energy.title')}</h1>
        <p className={styles.stateBody}>{t('client.energy.empty')}</p>
        <Button variant="primary" to="/spaces">
          {t('client.energy.emptyAction')}
        </Button>
      </section>
    );
  }

  if (state === 'noData') {
    const heartbeat = units
      .map((unit) => {
        return unit.device.lastHeartbeat;
      })
      .find((iso) => {
        return iso !== null;
      });
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.energy.noDataTitle')}</h1>
        <p className={styles.stateBody}>{t('client.energy.noDataBody')}</p>
        {heartbeat ? (
          <p className={styles.meta}>
            {t('loadState.lastSeen', { time: formatDate(heartbeat) })}
          </p>
        ) : null}
        <Button variant="primary" to="/spaces">
          {t('client.energy.noDataAction')}
        </Button>
      </section>
    );
  }

  const powerReadings = units
    .map((unit) => {
      return asReading(unit.live.powerW);
    })
    .filter((reading): reading is Reading => {
      return reading !== null;
    });
  const power = sumReadings(powerReadings.length === units.length ? powerReadings : []);
  const todayReadings = units
    .map((unit) => {
      if (isAbsent(unit.live.energyTodayKWh)) return null;
      return asReading(unit.live.energyTodayKWh);
    })
    .filter((reading): reading is Reading => {
      return reading !== null;
    });
  const today =
    todayReadings.length === units.length
      ? sumReadings(todayReadings)
      : lastDayKWh(series);
  const month = periodKWh(series);
  const saving = savingVsBaseline(series);
  const { actual: actualTotal, baseline: baselineTotal } = comparableTotals(series);
  const reporting = units.filter((unit) => {
    return unit.device.online;
  }).length;

  return (
    <div className={styles.root}>
      <ViewTabs items={INSIGHT_VIEWS} />
      <PageHeader titleKey="client.energy.title" contextKey="client.energy.purpose" />
      <div className={styles.choices}>
        <Button
          variant={days === 7 ? 'primary' : 'ghost'}
          current={days === 7}
          to="/insights?days=7"
        >
          {t('client.energy.days7')}
        </Button>
        <Button
          variant={days === 30 ? 'primary' : 'ghost'}
          current={days === 30}
          to="/insights?days=30"
        >
          {t('client.energy.days30')}
        </Button>
      </div>
      <p className={styles.meta}>
        {t('client.energy.tariff', {
          value: formatIdr(TARIFF.idrPerKWh),
          source: TARIFF.source,
          date: formatDate(TARIFF.effectiveFrom),
        })}
      </p>
      <MetricGrid>
        <MetricTile icon={Zap} tone="accent">
          <Metric
            labelKey="client.energy.powerNow"
            value={power.value}
            unit="W"
            provenance={power.provenance}
            lastSeen={power.lastSeen}
          />
        </MetricTile>
        <MetricTile icon={Zap} tone="accent">
          <Metric
            labelKey="client.energy.energyToday"
            value={today.value}
            unit="kWh"
            provenance={today.provenance}
            lastSeen={today.lastSeen}
          />
        </MetricTile>
        <MetricTile icon={CalendarDays} tone="accent">
          <Metric
            labelKey="client.energy.energyMonth"
            value={month.value}
            unit="kWh"
            provenance={month.provenance}
            lastSeen={month.lastSeen}
          />
        </MetricTile>
        <MetricTile icon={Wallet} tone="info">
          <Metric
            labelKey="client.energy.costToday"
            value={costOf(today).value}
            unit="IDR"
            provenance={costOf(today).provenance}
            lastSeen={costOf(today).lastSeen}
          />
        </MetricTile>
        <MetricTile icon={Wallet} tone="info">
          <Metric
            labelKey="client.energy.costMonth"
            value={costOf(month).value}
            unit="IDR"
            provenance={costOf(month).provenance}
            lastSeen={costOf(month).lastSeen}
          />
        </MetricTile>
      </MetricGrid>
      <p className={styles.meta}>
        {t('client.energy.coverage', {
          reporting: format(reporting),
          total: format(units.length),
        })}
      </p>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('client.energy.savingsTitle')}</h2>
        {/* One idea, one panel: the chart carries the shape of the period and
            the figures beside it carry the totals. They were loose on the
            canvas while every lesser block on the screen was carded. */}
        <div className={styles.panel}>
          <div className={styles.panelChart}>
            {series.actual.length > 1 ? (
              <Sparkline series={series} />
            ) : (
              <p>{t('loadState.noData')}</p>
            )}
            <ProvenanceChip provenance={series.provenance} />
            <p className={styles.meta}>
              {t('client.energy.completeness', {
                value: format(series.completeness * 100),
              })}
            </p>
            <Button variant="ghost" to={series.method.href}>
              {t('client.energy.methodLink')}
            </Button>
          </div>
          <div className={styles.metrics}>
            <Metric
              labelKey="client.energy.savingKwh"
              value={saving.kWh.value}
              unit="kWh"
              provenance={saving.kWh.provenance}
              lastSeen={saving.kWh.lastSeen}
            />
            <Metric
              labelKey="client.energy.savingIdr"
              value={saving.idr.value}
              unit="IDR"
              provenance={saving.idr.provenance}
              lastSeen={saving.idr.lastSeen}
            />
            <Metric
              labelKey="client.energy.savingPct"
              value={saving.pct.value}
              unit="%"
              provenance={saving.pct.provenance}
              lastSeen={saving.pct.lastSeen}
            />
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('client.energy.leversTitle')}</h2>
        <ul className={styles.list}>
          {series.levers.map((lever) => {
            return (
              <li key={lever.key} className={styles.card}>
                <p className={styles.cardTitle}>
                  {t(`client.energy.lever.${lever.key}`)}
                </p>
                <Metric
                  labelKey="client.energy.savingKwh"
                  value={lever.kWh}
                  unit="kWh"
                  provenance={series.provenance}
                  lastSeen={series.actual.at(-1)?.t ?? null}
                />
                <Button variant="ghost" to={LEVER_HREF[lever.key] ?? '/spaces'}>
                  {t(`client.energy.leverAction.${lever.key}`)}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('client.energy.byRoom')}</h2>
        <ul className={styles.list}>
          {rooms.map((row) => {
            const kWh = periodKWh(row.series);
            return (
              <li key={row.roomName} className={styles.card}>
                <p className={styles.cardTitle}>{row.roomName}</p>
                <Metric
                  labelKey="client.energy.energyMonth"
                  value={kWh.value}
                  unit="kWh"
                  provenance={kWh.provenance}
                  lastSeen={kWh.lastSeen}
                />
              </li>
            );
          })}
        </ul>
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('client.energy.byUnit')}</h2>
        <ul className={styles.list}>
          {unitRows.map((row) => {
            const kWh = periodKWh(row.series);
            return (
              <li key={row.unit.id} className={styles.card}>
                <p className={styles.cardTitle}>{row.unit.name}</p>
                <Metric
                  labelKey="client.energy.energyMonth"
                  value={kWh.value}
                  unit="kWh"
                  provenance={kWh.provenance}
                  lastSeen={kWh.lastSeen}
                />
                <Button variant="ghost" to={links.unit(row.unit.id)}>
                  {row.unit.name}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <p className={styles.meta}>
        {t('client.energy.chartAlt', {
          actual: format(actualTotal),
          baseline: format(baselineTotal),
        })}
      </p>
    </div>
  );
}

/**
 * Actual and baseline over the SAME days, which is the only way the two are
 * comparable. The generator emits a baseline for every day in the period but
 * skips `actual` on any day a unit was silent, so the arrays routinely differ
 * in length — Rumah Bintaro runs 27 actual against 30 baseline. Summing them
 * whole compares a 30-day normal with a 27-day meter and reports the two
 * missing days as a saving. `savingVsBaseline` in `energy.ts` has guarded
 * against exactly this since it was written; this screen has to do the same,
 * and in ONE place, because the two call sites had already drifted apart.
 */
function comparableTotals(series: EnergySeries) {
  const reported = new Set(series.actual.map((point) => point.t));
  const sum = (points: readonly { kWh: number }[]) =>
    points.reduce((total, point) => total + point.kWh, 0);
  return {
    actual: sum(series.actual),
    baseline: sum(series.baseline.filter((point) => reported.has(point.t))),
  };
}

function Sparkline({ series }: { series: EnergySeries }) {
  const { t, i18n } = useTranslation();
  /** Two sparklines can share a page, so the gradient needs its own id. */
  const areaId = `${useId()}-area`;
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  const { actual: actualTotal, baseline: baselineTotal } = comparableTotals(series);
  const max = Math.max(
    ...series.actual.map((point) => {
      return point.kWh;
    }),
    ...series.baseline.map((point) => {
      return point.kWh;
    }),
    1,
  );
  // One x axis for both lines: the sorted union of every day either series
  // reports. Scaling each series across its own length instead stretched a
  // 27-day meter to the full width of a 30-day normal and stacked the two on
  // top of each other, so any vertical comparison read off two different days.
  const domain = [
    ...new Set([...series.baseline, ...series.actual].map((point) => point.t)),
  ].sort();
  const xAt = (stamp: string) => {
    const index = domain.indexOf(stamp);
    return domain.length <= 1 ? 0 : (index / (domain.length - 1)) * 100;
  };

  // Contiguous runs of reported days. A day with no meter reading breaks the
  // run rather than being drawn through — missing is not zero, and a line
  // crossing a silent day is a reading nobody took (D7 §11.2). The fill below
  // is built from the same runs, so a gap is a gap in both channels.
  const runsOf = (points: readonly { t: string; kWh: number }[]) => {
    const byDay = new Map(points.map((point) => [point.t, point.kWh] as const));
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    domain.forEach((stamp) => {
      const kWh = byDay.get(stamp);
      if (kWh === undefined) {
        if (run.length > 0) runs.push(run);
        run = [];
        return;
      }
      run.push({ x: xAt(stamp), y: 28 - (kWh / max) * 26 });
    });
    if (run.length > 0) runs.push(run);
    return runs;
  };

  const draw = (run: { x: number; y: number }[]) =>
    run
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

  const toPath = (points: readonly { t: string; kWh: number }[]) =>
    runsOf(points).map(draw).join(' ');

  /** The same runs, closed to the floor of the plot so the line reads as a
   *  quantity rather than as a squiggle. */
  const toArea = (points: readonly { t: string; kWh: number }[]) =>
    runsOf(points)
      .filter((run) => run.length > 1)
      .map((run) => {
        const last = run[run.length - 1];
        return `${draw(run)} L ${last.x.toFixed(2)} 30 L ${run[0].x.toFixed(2)} 30 Z`;
      })
      .join(' ');

  /** Quarter gridlines. A trend with nothing behind it is a shape; with a
   *  scale behind it, it is a reading. */
  const gridlines = [0.25, 0.5, 0.75].map((fraction) => 28 - fraction * 26);

  return (
    <figure className={styles.sparkline}>
      <svg
        className={styles.chart}
        viewBox="0 0 100 30"
        /* A trend line, not a shape: let it fill the panel rather than
           letterbox itself in the middle. `non-scaling-stroke` below keeps
           the stroke even once the box is no longer 100:30. */
        preserveAspectRatio="none"
        role="img"
        aria-label={t('client.energy.chartAlt', {
          actual: format(actualTotal),
          baseline: format(baselineTotal),
        })}
      >
        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop className={styles.areaTop} offset="0%" />
            <stop className={styles.areaBottom} offset="100%" />
          </linearGradient>
        </defs>
        {gridlines.map((y) => (
          <line key={y} className={styles.gridline} x1="0" x2="100" y1={y} y2={y} />
        ))}
        {series.actual.length > 1 ? (
          <path
            className={styles.chartArea}
            d={toArea(series.actual)}
            fill={`url(#${areaId})`}
          />
        ) : null}
        {series.baseline.length > 1 ? (
          <path className={styles.chartBaseline} d={toPath(series.baseline)} />
        ) : null}
        {series.actual.length > 1 ? (
          <path className={styles.chartActual} d={toPath(series.actual)} />
        ) : null}
      </svg>
      <ul className={styles.legend}>
        <li className={styles.legendActual}>{t('client.energy.actualSeries')}</li>
        <li className={styles.legendBaseline}>{t('client.energy.baselineSeries')}</li>
      </ul>
    </figure>
  );
}
