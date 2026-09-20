/**
 * Client Home read model. Derived from the same facts every other screen
 * reads — nothing on C-1 is authored twice.
 *
 * @requirement FR-10 FR-15 FR-61 FR-70
 */
import { comfortSeverity, comfortVerdict } from '../domain/comfort.ts';
import { SEVERITY, countAtOrAbove, rollUp } from '../domain/severity.ts';
import { buildCarbonSummary } from './carbon.ts';
import { buildEnergySeries, savingVsBaseline, trailingPeriod } from './energy.ts';
import { links } from './links.ts';
import { SIMULATED_POLICY } from './policy.ts';
import { asReading, isAbsent } from './readings.ts';
import { round } from './random.ts';
import { walkRooms, walkUnits } from './tree.ts';
import type { SimDataset } from './build.ts';
import { SENSOR_KEYS, sensorLabelKey } from './types.ts';
import type {
  AccountStanding,
  AttentionItem,
  ClientOverview,
  Property,
  Reading,
} from './types.ts';

const rank = (severity: keyof typeof SEVERITY): number => SEVERITY[severity].rank;

const pickChannel = (readings: Reading[], fallback: Reading): Reading =>
  readings.find((r) => r.value !== null) ?? readings[0] ?? fallback;

export function deriveClientOverview(
  dataset: SimDataset,
  property: Property,
  now: Date,
): ClientOverview {
  const period = trailingPeriod(now, SIMULATED_POLICY.historyDays);
  const energy = buildEnergySeries(dataset, property.id, period);
  const carbon = buildCarbonSummary(dataset, property.id, period);
  const saving = savingVsBaseline(energy);
  const lastActual =
    energy.actual.at(-1)?.t ?? energy.baseline.at(-1)?.t ?? now.toISOString();
  const units = walkUnits([property]);
  let todaySum = 0;
  let reportingUnits = 0;
  let todaySeen: string | null = null;
  for (const unit of units) {
    const reading = asReading(unit.live.energyTodayKWh);
    if (reading?.value != null) {
      todaySum += reading.value;
      reportingUnits += 1;
      todaySeen = reading.lastSeen;
    } else if (reading?.lastSeen && todaySeen === null) {
      todaySeen = reading.lastSeen;
    }
  }
  const energyToday = {
    kWh: {
      value: reportingUnits === 0 ? null : round(todaySum, 1),
      provenance: energy.provenance,
      lastSeen: todaySeen,
    },
    reportingUnits,
    totalUnits: units.length,
  };

  const unseen: Reading = {
    value: null,
    provenance: 'simulated',
    lastSeen: lastActual,
  };

  const rooms = walkRooms([property]).map(({ room, floor }) => {
    const temps = room.units
      .map((u) => asReading(u.live.temperatureC))
      .filter((r): r is Reading => r !== null);
    const hums = room.units
      .map((u) => asReading(u.live.humidityPct))
      .filter((r): r is Reading => r !== null);
    const temperatureC = pickChannel(temps, unseen);
    const humidityPct = pickChannel(hums, unseen);
    const verdict = comfortVerdict(
      {
        temperatureC: temperatureC.value,
        humidityPct: humidityPct.value,
      },
      SIMULATED_POLICY.comfortEnvelope,
    );
    const equipmentSev = room.units.map((u) => u.rollUp.severity);
    const absentSensorKeys = [
      ...new Set(
        room.units.flatMap((u) =>
          SENSOR_KEYS.filter((key) => isAbsent(u.live[key])).map((key) =>
            sensorLabelKey(key),
          ),
        ),
      ),
    ];
    return {
      roomId: room.id,
      name: room.name,
      floorId: floor.id,
      floorName: floor.name,
      floorNameKey: floor.nameKey,
      healthSensitive: room.healthSensitive,
      verdict,
      comfortSeverity: comfortSeverity(verdict),
      temperatureC,
      humidityPct,
      absentSensorKeys,
      equipment: {
        severity: rollUp(equipmentSev),
        contributing: countAtOrAbove(equipmentSev, 'unknown'),
        total: equipmentSev.length,
      },
      href: links.node(room.id),
    };
  });

  rooms.sort((a, b) => {
    const aRank = Math.max(rank(a.equipment.severity), rank(a.comfortSeverity));
    const bRank = Math.max(rank(b.equipment.severity), rank(b.comfortSeverity));
    return bRank - aRank;
  });

  const comfortable = rooms.filter((r) => r.verdict === 'comfortable').length;
  const unknown = rooms.filter((r) => r.verdict === 'unknown').length;
  const alerts = dataset.alerts
    .filter((a) => a.scope.propertyId === property.id)
    .sort((a, b) => rank(b.severity) - rank(a.severity));

  const account: AccountStanding = dataset.accounts[property.id] ?? {
    balanceIdr: { value: null, provenance: 'simulated', lastSeen: null },
    dueAt: now.toISOString(),
    state: 'current',
    restriction: null,
    payAction: { labelKey: 'billing.pay', href: links.billing() },
  };

  const attention: AttentionItem[] = [];
  if (account.state !== 'current') {
    attention.push({
      id: `att-pay-${property.id}`,
      kind: 'payment',
      severity: 'warning',
      titleKey: 'attention.payment.title',
      bodyKey: 'attention.payment.body',
      action: account.payAction,
      dueAt: account.dueAt,
      scope: { propertyId: property.id },
    });
  }
  if (account.restriction) {
    const restricted = units.find((u) => u.restriction);
    attention.push({
      id: `att-restrict-${property.id}`,
      kind: 'restriction',
      severity: 'warning',
      titleKey: 'attention.restriction.title',
      bodyKey: 'attention.restriction.body',
      action: { labelKey: 'attention.restriction.action', href: links.billing() },
      dueAt: account.restriction.graceEndsAt,
      scope: { propertyId: property.id, unitId: restricted?.id },
    });
  }
  for (const alert of alerts.filter(
    (a) => a.state === 'needsAction' && a.category !== 'payment',
  )) {
    attention.push({
      id: `att-${alert.id}`,
      kind:
        alert.category === 'tamper'
          ? 'tamper'
          : alert.category === 'fault'
            ? 'fault'
            : 'dataQuality',
      severity: alert.severity,
      titleKey: alert.titleKey,
      bodyKey: alert.impactIfIgnoredKey,
      action: alert.recommendedAction,
      dueAt: null,
      scope: alert.scope,
    });
  }
  const visit = dataset.maintenance.find(
    (m) =>
      m.scope.propertyId === property.id &&
      (m.state === 'scheduled' || m.state === 'overdue' || m.state === 'inProgress'),
  );
  if (visit) {
    attention.push({
      id: `att-visit-${visit.id}`,
      kind: 'visit',
      severity: 'warning',
      titleKey: 'attention.visit.title',
      bodyKey: 'attention.visit.body',
      action: visit.action,
      dueAt: visit.at,
      scope: visit.scope,
    });
  }

  return {
    generatedAt: now.toISOString(),
    property: { id: property.id, name: property.name, category: property.category },
    rollUp: property.rollUp,
    hero: {
      avoidedKgCO2e: carbon.avoidedKgCO2e,
      period,
      gridFactor: carbon.gridFactor,
      method: energy.method,
      completeness: energy.completeness,
    },
    kpis: {
      comfort: {
        comfortable,
        total: rooms.length,
        unknown,
        provenance: 'simulated',
      },
      energyToday,
      savingVsNormal: {
        kWh: saving.kWh,
        pct: saving.pct,
        idr: saving.idr,
        method: energy.method,
        completeness: energy.completeness,
      },
    },
    rooms,
    alerts,
    attention,
    maintenance: dataset.maintenance.filter((m) => m.scope.propertyId === property.id),
    energy,
  };
}

export const selectClientOverview = deriveClientOverview;
