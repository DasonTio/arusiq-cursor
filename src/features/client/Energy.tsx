/**
 * client.energy — power, kWh, tariff cost, and saving versus the adjusted
 * baseline. The chart always carries a link to shared.method.
 *
 * @requirement FR-60 FR-61 FR-62
 */
import { useEffect, useState } from 'react';
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
  const actualTotal = series.actual.reduce((sum, point) => {
    return sum + point.kWh;
  }, 0);
  const baselineTotal = series.baseline
    .filter((point) => {
      return series.actual.some((actual) => {
        return actual.t === point.t;
      });
    })
    .reduce((sum, point) => {
      return sum + point.kWh;
    }, 0);
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
        <MetricTile>
          <Metric
            labelKey="client.energy.powerNow"
            value={power.value}
            unit="W"
            provenance={power.provenance}
            lastSeen={power.lastSeen}
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="client.energy.energyToday"
            value={today.value}
            unit="kWh"
            provenance={today.provenance}
            lastSeen={today.lastSeen}
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="client.energy.energyMonth"
            value={month.value}
            unit="kWh"
            provenance={month.provenance}
            lastSeen={month.lastSeen}
          />
        </MetricTile>
        <MetricTile>
          <Metric
            labelKey="client.energy.costToday"
            value={costOf(today).value}
            unit="IDR"
            provenance={costOf(today).provenance}
            lastSeen={costOf(today).lastSeen}
          />
        </MetricTile>
        <MetricTile>
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

function Sparkline({ series }: { series: EnergySeries }) {
  const { t, i18n } = useTranslation();
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  const actualTotal = series.actual.reduce((sum, point) => {
    return sum + point.kWh;
  }, 0);
  const baselineTotal = series.baseline.reduce((sum, point) => {
    return sum + point.kWh;
  }, 0);
  const max = Math.max(
    ...series.actual.map((point) => {
      return point.kWh;
    }),
    ...series.baseline.map((point) => {
      return point.kWh;
    }),
    1,
  );
  const toPath = (points: { kWh: number }[]) =>
    points
      .map((point, index) => {
        const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
        const y = 28 - (point.kWh / max) * 26;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

  return (
    <figure className={styles.sparkline}>
      <svg
        className={styles.chart}
        viewBox="0 0 100 30"
        role="img"
        aria-label={t('client.energy.chartAlt', {
          actual: format(actualTotal),
          baseline: format(baselineTotal),
        })}
      >
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
