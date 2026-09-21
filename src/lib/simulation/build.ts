/**
 * Facts → the typed tree the adapter serves.
 *
 * Three rules hold everywhere in this file:
 *
 * 1. Provenance is stamped on the VALUE, here, at the source (ADR-0004). No
 *    caller decides what label a number deserves.
 * 2. A value we do not have is `null` with a `lastSeen`, and the part that
 *    depended on it becomes `unknown`. It is never the last number we happened
 *    to receive, and it is never 0 (INV-NO-FABRICATION).
 * 3. Severity is rolled up with `rollUp()` and counted with `countAtOrAbove()`
 *    from `lib/domain`. The comparison exists once.
 *
 * @requirement FR-13 FR-15 FR-20 FR-21 FR-33
 */
import { countAtOrAbove, rollUp } from '../domain/severity.ts';
import type { Severity } from '../domain/severity.ts';
import { isStale } from '../domain/freshness.ts';
import { SIMULATED_POLICY } from './policy.ts';
import {
  partDefinition,
  PART_CATALOGUE,
  partLabelKey,
  signalLabelKey,
} from './catalogue.ts';
import type { SignalDefinition } from './catalogue.ts';
import {
  ACCESS,
  BILLING_SPECS,
  DELIVERY_BY_CATEGORY,
  MAINTENANCE_SPECS,
  PROPERTY_SPECS,
  RESOLVED_ALERT_SPECS,
  TECHNICIANS,
} from './fixtures.ts';
import type { PartFaultSpec, PropertySpec, UnitSpec } from './fixtures.ts';
import { links } from './links.ts';
import {
  DAY_MS,
  daysAfter,
  daysBefore,
  hoursAfter,
  hoursBefore,
  minutesBefore,
  startOfLocalDay,
} from './clock.ts';
import { createRng, round } from './random.ts';
import { buildWorkOrders } from './workorders.ts';
import {
  buildHealthSensitiveDesignation,
  buildRestrictionRequests,
  refreshAccountRestrictions,
} from './restrictions.ts';
import { SENSOR_KEYS } from './types.ts';
import type {
  AccountStanding,
  Alert,
  AlertEvidence,
  Floor,
  HealthSensitiveDesignation,
  RestrictionRequest,
  LiveReadings,
  MaintenanceEvent,
  MaybeReading,
  Part,
  Property,
  Reading,
  Room,
  SensorKey,
  Unit,
  UnitRestriction,
  WorkOrder,
} from './types.ts';

/* ----------------------------------------------------------------- helpers */

const simulated = (value: number | null, lastSeen: string): Reading => ({
  value,
  provenance: 'simulated',
  lastSeen,
});

/**
 * The value a signal reports when the part is behaving.
 *
 * A signal whose nominal is ZERO counts occurrences — frost minutes, overflow
 * events, louver faults, contactor chatter — and a count has no negative
 * side. The jitter is symmetric, so half of those rolls were coming out
 * below zero and the unit screen was publishing "−1 min" of frost and "−0 n"
 * of overflow. Missing is not zero (INV-NO-FABRICATION), and neither is a
 * count that never happened minus one.
 */
const nominalValue = (def: SignalDefinition, jitter: number): number => {
  const value = def.nominal + jitter * (def.threshold - def.nominal) * 0.25;
  return round(def.nominal === 0 ? Math.max(0, value) : value, def.decimals);
};

/** The value a signal reports at `breach` multiples past its threshold.
 *  `direction` matters: superheat fails downward, pressure drop upward. */
const breachedValue = (def: SignalDefinition, breach: number): number =>
  round(def.nominal + breach * (def.threshold - def.nominal), def.decimals);

/* ------------------------------------------------------------------- units */

export interface UnitContext {
  now: Date;
  propertyId: string;
  floorId: string;
  roomId: string;
  healthSensitive: boolean;
}

interface BuiltUnit {
  unit: Unit;
  /** Kept out of `Unit` because it is a simulator input, not an API field. */
  spec: UnitSpec;
  /** True when live readings are past the freshness window or the device is
   *  offline. Alerts and comfort verdicts both key off this. */
  blind: boolean;
  lastReportAt: string;
}

const buildRestriction = (
  spec: UnitSpec,
  now: Date,
  healthSensitive: boolean,
): UnitRestriction | null => {
  const r = spec.restriction;
  if (!r) return null;
  const at = hoursBefore(now, r.decidedHoursAgo);
  return {
    step: r.step,
    reasonKey: r.reasonKey,
    graceEndsAt: hoursAfter(now, r.graceHours - r.decidedHoursAgo),
    approval: {
      requester: r.requester,
      approver: r.approver,
      at,
      // ADR-0015 OD-02 — rung 4 only. A sign-off authored on a lower rung is
      // dropped rather than carried: "dual approval" is two-person control,
      // and a third name on a *reminder* is ceremony the ADR rejected.
      ...(r.step === 'stop' && r.signedOffBy
        ? { signedOff: { manager: r.signedOffBy, at } }
        : {}),
    },
    healthSensitive,
  };
};

/**
 * Live sensor channels. Three outcomes, and they are not interchangeable: a
 * channel that is not fitted is `absent`, a channel that has gone quiet is
 * `null` with a last-seen time, and only a channel reporting now has a number.
 */
const buildLive = (
  spec: UnitSpec,
  ctx: UnitContext,
  blind: boolean,
  lastReportAt: string,
  worstFault: Severity,
): LiveReadings => {
  const rng = createRng(`live:${spec.id}`);
  const absent = new Set<SensorKey>(spec.absentSensors ?? []);
  const setpoint = spec.setpointC ?? 25;
  const off = (spec.mode ?? 'cool') === 'off';

  // A unit that cannot hold its setpoint is warmer than it was asked to be.
  // The penalty is derived from the fault, not authored per screen, so the
  // comfort verdict and the alert cannot tell different stories.
  const penalty = off
    ? 5.4
    : worstFault === 'critical'
      ? 2.6
      : worstFault === 'warning'
        ? 0.9
        : 0;

  const dayFraction = (ctx.now.getTime() - startOfLocalDay(ctx.now).getTime()) / DAY_MS;

  const value = (key: SensorKey): number => {
    switch (key) {
      case 'temperatureC':
        return round(setpoint + penalty + rng.float(-0.4, 0.4), 1);
      case 'humidityPct':
        return round(48 + (penalty > 2 ? 11 : 0) + rng.float(-5, 8), 0);
      case 'powerW':
        // A stopped unit genuinely draws standby power. This is a measured
        // zero-ish value, not a missing one — which is why it is never null.
        return off
          ? 12
          : Math.round(spec.baseDailyKWh * 1000 * rng.float(0.05, 0.075, 4));
      case 'energyTodayKWh':
        return round(spec.baseDailyKWh * dayFraction * rng.float(0.85, 1.12, 3), 2);
      case 'co2Ppm':
        return Math.round(rng.float(420, 780, 0));
      case 'pm25':
        return round(rng.float(6, 24), 1);
    }
  };

  const entries = SENSOR_KEYS.map((key): [SensorKey, MaybeReading] => {
    if (absent.has(key)) return [key, { kind: 'absent', sensorKey: key }];
    if (blind) return [key, simulated(null, lastReportAt)];
    return [key, simulated(value(key), lastReportAt)];
  });

  return Object.fromEntries(entries) as LiveReadings;
};

const buildParts = (spec: UnitSpec, blind: boolean, lastReportAt: string): Part[] => {
  const faults = new Map((spec.faults ?? []).map((f) => [f.partId, f]));
  const rng = createRng(`parts:${spec.id}`);

  // Catalogue order, every unit, so the part grid does not reshuffle between
  // screens and "the twelve" is always twelve.
  return PART_CATALOGUE.map((def): Part => {
    const fault = faults.get(def.id);
    const signals = def.signals.map((sig, i) => ({
      key: signalLabelKey(def.id, sig.key),
      reading: blind
        ? simulated(null, lastReportAt)
        : simulated(
            fault && i === 0
              ? breachedValue(sig, fault.breach)
              : nominalValue(sig, rng.float(-1, 1, 3)),
            lastReportAt,
          ),
    }));

    // The one rule: an asserted fault wins, and anything we cannot currently
    // measure is `unknown`. There is no path from "no data" to `normal`.
    const severity: Severity = fault ? fault.severity : blind ? 'unknown' : 'normal';

    return {
      id: def.id,
      group: def.group,
      labelKey: partLabelKey(def.id),
      severity,
      suspected: fault?.suspected ?? false,
      signals,
    };
  });
};

const buildUnit = (spec: UnitSpec, ctx: UnitContext): BuiltUnit => {
  const offline = spec.device?.offline ?? false;
  const lastHeartbeat = offline
    ? minutesBefore(ctx.now, spec.device?.lastHeartbeatMinutesAgo ?? 60)
    : minutesBefore(ctx.now, spec.device?.lastHeartbeatMinutesAgo ?? 1);
  const lastReportAt = offline
    ? lastHeartbeat
    : minutesBefore(ctx.now, spec.device?.lastReportMinutesAgo ?? 2);
  const blind =
    offline ||
    isStale(lastReportAt, ctx.now, SIMULATED_POLICY.freshnessWindowMinutes * 60 * 1000);

  const worstFault = rollUp((spec.faults ?? []).map((f) => f.severity));
  const parts = buildParts(spec, blind, lastReportAt);
  const partSeverities = parts.map((p) => p.severity);
  const tamper = spec.device?.tamperSuspected ?? false;

  // D7 §14.5 — tamper raises the unit's severity but is NOT counted as one of
  // the twelve parts: it is a device-trust event with its own icon and its own
  // filter, and folding it into the part count would hide it in a total.
  const severity = rollUp([...partSeverities, tamper ? 'critical' : 'normal']);

  const unit: Unit = {
    id: spec.id,
    name: spec.name,
    nameKey: null,
    rollUp: {
      severity,
      contributing: countAtOrAbove(partSeverities, 'unknown'),
      total: parts.length,
    },
    brand: spec.brand,
    parts,
    live: buildLive(spec, ctx, blind, lastReportAt, worstFault),
    control: {
      mode: spec.mode ?? 'cool',
      setpointC: spec.setpointC ?? 25,
      fanSpeed: spec.fanSpeed ?? 'auto',
      lastCommand: spec.lastCommand
        ? {
            state: spec.lastCommand.state,
            at: minutesBefore(ctx.now, spec.lastCommand.minutesAgo),
          }
        : null,
    },
    device: {
      online: !offline,
      lastHeartbeat,
      tamperSuspected: tamper,
      maintenanceMode: spec.device?.maintenanceMode ?? false,
    },
    restriction: buildRestriction(spec, ctx.now, ctx.healthSensitive),
  };

  return { unit, spec, blind, lastReportAt };
};

/* ------------------------------------------------------------------ alerts */

const delivery = (category: Alert['category'], raisedAt: string): Alert['delivery'] =>
  DELIVERY_BY_CATEGORY[category].map((channel, i) => ({
    channel,
    // The last channel of a tamper alert fails on purpose: "delivered" and
    // "we tried" must be distinguishable (D6 FR-22).
    state:
      category === 'tamper' && channel === 'email'
        ? 'failed'
        : i === 0
          ? 'read'
          : 'delivered',
    at: raisedAt,
  }));

const faultAlert = (
  built: BuiltUnit,
  fault: PartFaultSpec,
  ctx: UnitContext,
): Alert => {
  const def = partDefinition(fault.partId);
  const raisedAt = daysBefore(ctx.now, fault.sinceDays);
  const evidence: AlertEvidence[] = def.signals.slice(0, 2).map((sig, i) => ({
    signalKey: signalLabelKey(def.id, sig.key),
    observed: simulated(
      i === 0 ? breachedValue(sig, fault.breach) : nominalValue(sig, 0.4),
      built.lastReportAt,
    ),
    threshold: { value: sig.threshold, provenance: 'simulated', lastSeen: null },
    unit: sig.unit,
    since: raisedAt,
  }));

  return {
    id: `alert-${built.spec.id}-${def.id}`,
    severity: fault.severity,
    category: 'fault',
    state:
      fault.severity === 'critical' || !fault.suspected ? 'needsAction' : 'watching',
    suspected: fault.suspected,
    signalClass: def.signalClass,
    scope: {
      propertyId: ctx.propertyId,
      floorId: ctx.floorId,
      roomId: ctx.roomId,
      unitId: built.spec.id,
      partId: def.id,
    },
    titleKey: `alert.fault.${def.id}.title`,
    likelyCauseKey: `alert.fault.${def.id}.cause`,
    impactIfIgnoredKey: `alert.fault.${def.id}.impact`,
    recommendedAction: {
      labelKey: `alert.fault.${def.id}.action`,
      href: links.serviceRequest(`alert-${built.spec.id}-${def.id}`),
    },
    evidence,
    confidence: fault.confidence,
    raisedAt,
    // D6 FR-20 — a slow signal is a trend with a projected date and a band.
    // An acute one is a breach, and inventing a projection for it would be
    // inventing a number.
    projection:
      def.signalClass === 'slow' && fault.projectionDays
        ? {
            failureBy: daysAfter(ctx.now, fault.projectionDays.failureBy),
            confidenceBand: {
              earliest: daysAfter(ctx.now, fault.projectionDays.earliest),
              latest: daysAfter(ctx.now, fault.projectionDays.latest),
            },
            provenance: 'estimated',
          }
        : null,
    delivery: delivery('fault', raisedAt),
    provenance: 'simulated',
  };
};

const tamperAlert = (built: BuiltUnit, ctx: UnitContext): Alert => {
  const raisedAt = hoursBefore(ctx.now, 5);
  return {
    id: `alert-${built.spec.id}-tamper`,
    severity: 'critical',
    category: 'tamper',
    state: 'needsAction',
    suspected: false,
    signalClass: 'acute',
    scope: {
      propertyId: ctx.propertyId,
      floorId: ctx.floorId,
      roomId: ctx.roomId,
      unitId: built.spec.id,
    },
    titleKey: 'alert.tamper.title',
    likelyCauseKey: 'alert.tamper.cause',
    impactIfIgnoredKey: 'alert.tamper.impact',
    recommendedAction: {
      labelKey: 'alert.tamper.action',
      href: links.serviceRequest(`alert-${built.spec.id}-tamper`),
    },
    evidence: [
      {
        signalKey: 'signal.device.enclosureOpened',
        observed: simulated(3, raisedAt),
        threshold: { value: 0, provenance: 'simulated', lastSeen: null },
        unit: 'n',
        since: raisedAt,
      },
    ],
    confidence: 0.96,
    raisedAt,
    projection: null,
    delivery: delivery('tamper', raisedAt),
    provenance: 'simulated',
  };
};

/**
 * The grey alert. It exists because "we cannot see this unit" is a condition
 * somebody has to act on, and a dashboard that silently drops an offline unit
 * is how it stops being noticed (INV-GREY).
 */
const dataQualityAlert = (built: BuiltUnit, ctx: UnitContext): Alert => {
  const offline = !built.unit.device.online;
  const raisedAt = built.lastReportAt;
  const minutesQuiet = Math.round(
    (ctx.now.getTime() - Date.parse(built.lastReportAt)) / 60_000,
  );
  return {
    id: `alert-${built.spec.id}-${offline ? 'offline' : 'stale'}`,
    severity: 'unknown',
    category: 'dataQuality',
    state: offline ? 'needsAction' : 'watching',
    suspected: false,
    signalClass: 'acute',
    scope: {
      propertyId: ctx.propertyId,
      floorId: ctx.floorId,
      roomId: ctx.roomId,
      unitId: built.spec.id,
    },
    titleKey: offline
      ? 'alert.dataQuality.offline.title'
      : 'alert.dataQuality.stale.title',
    likelyCauseKey: offline
      ? 'alert.dataQuality.offline.cause'
      : 'alert.dataQuality.stale.cause',
    impactIfIgnoredKey: 'alert.dataQuality.impact',
    recommendedAction: {
      labelKey: 'alert.dataQuality.action',
      href: links.unit(built.spec.id),
    },
    evidence: [
      {
        signalKey: 'signal.device.minutesSinceReport',
        observed: simulated(minutesQuiet, built.lastReportAt),
        threshold: {
          value: SIMULATED_POLICY.freshnessWindowMinutes,
          provenance: 'simulated',
          lastSeen: null,
        },
        unit: 'min',
        since: raisedAt,
      },
    ],
    confidence: 1,
    raisedAt,
    projection: null,
    delivery: delivery('dataQuality', raisedAt),
    provenance: 'simulated',
  };
};

const paymentAlert = (propertyId: string, standing: AccountStanding): Alert => ({
  id: `alert-${propertyId}-payment`,
  severity: 'warning',
  category: 'payment',
  state: 'needsAction',
  suspected: false,
  signalClass: 'acute',
  scope: { propertyId },
  titleKey: 'alert.payment.title',
  likelyCauseKey: 'alert.payment.cause',
  impactIfIgnoredKey: 'alert.payment.impact',
  recommendedAction: standing.payAction,
  evidence: [
    {
      signalKey: 'signal.account.balance',
      observed: standing.balanceIdr,
      threshold: { value: 0, provenance: 'simulated', lastSeen: null },
      unit: 'IDR',
      since: standing.dueAt,
    },
  ],
  confidence: 1,
  raisedAt: standing.dueAt,
  projection: null,
  delivery: delivery('payment', standing.dueAt),
  provenance: 'simulated',
});

const resolvedAlerts = (now: Date, unitLocation: Map<string, UnitContext>): Alert[] =>
  RESOLVED_ALERT_SPECS.flatMap((spec) => {
    const ctx = unitLocation.get(spec.unitId);
    if (!ctx) return [];
    const def = partDefinition(spec.partId);
    const raisedAt = daysBefore(now, spec.raisedDaysAgo);
    return [
      {
        id: spec.id,
        severity: spec.severity,
        category: 'fault',
        state: 'resolved',
        suspected: false,
        signalClass: def.signalClass,
        scope: {
          propertyId: ctx.propertyId,
          floorId: ctx.floorId,
          roomId: ctx.roomId,
          unitId: spec.unitId,
          partId: def.id,
        },
        titleKey: `alert.fault.${def.id}.title`,
        likelyCauseKey: `alert.fault.${def.id}.cause`,
        impactIfIgnoredKey: `alert.fault.${def.id}.impact`,
        recommendedAction: {
          labelKey: 'alert.viewHistory',
          href: links.service(spec.closedByEventId),
        },
        evidence: def.signals.slice(0, 1).map((sig) => ({
          signalKey: signalLabelKey(def.id, sig.key),
          observed: simulated(breachedValue(sig, 1.2), raisedAt),
          threshold: { value: sig.threshold, provenance: 'simulated', lastSeen: null },
          unit: sig.unit,
          since: raisedAt,
        })),
        confidence: spec.confidence,
        raisedAt,
        projection: null,
        delivery: delivery('fault', raisedAt),
        provenance: 'simulated',
      } satisfies Alert,
    ];
  });

/* ------------------------------------------------------------------ account */

const buildAccounts = (now: Date): Record<string, AccountStanding> =>
  Object.fromEntries(
    BILLING_SPECS.map((b) => [
      b.propertyId,
      {
        balanceIdr: simulated(b.balanceIdr, daysBefore(now, Math.abs(b.dueInDays))),
        dueAt:
          b.dueInDays < 0 ? daysBefore(now, -b.dueInDays) : daysAfter(now, b.dueInDays),
        state: b.state,
        restriction: null,
        payAction: { labelKey: 'billing.pay', href: links.billing() },
      } satisfies AccountStanding,
    ]),
  );

/* ------------------------------------------------------------- maintenance */

const technicianById = (id: string | undefined) =>
  id ? (TECHNICIANS.find((t) => t.id === id) ?? null) : null;

const buildMaintenance = (now: Date): MaintenanceEvent[] =>
  MAINTENANCE_SPECS.map((spec) => ({
    id: spec.id,
    kind: spec.kind,
    state: spec.state,
    at:
      spec.daysFromNow < 0
        ? daysBefore(now, -spec.daysFromNow)
        : daysAfter(now, spec.daysFromNow),
    scope: {
      propertyId: spec.propertyId,
      roomId: spec.roomId,
      unitId: spec.unitId,
    },
    titleKey: `maintenance.${spec.kind}.title`,
    workOrderId: spec.workOrderId ?? null,
    technician: technicianById(spec.technicianId),
    alertId: spec.alertId ?? null,
    action: {
      labelKey: `maintenance.${spec.state}.action`,
      href: links.service(spec.id),
    },
    provenance: 'simulated',
  }));

/* ----------------------------------------------------------------- dataset */

export interface SimDataset {
  generatedAt: string;
  properties: Property[];
  alerts: Alert[];
  maintenance: MaintenanceEvent[];
  /** D2 O-WO — built AFTER the alerts, because a work order's evidence is the
   *  alert's evidence rather than a second copy of it. */
  workOrders: WorkOrder[];
  /** ADR-0015 / FR-52 — the approval queue. Built AFTER the tree, because a
   *  request has to read the rung actually in force on the space it names. */
  restrictionRequests: RestrictionRequest[];
  accounts: Record<string, AccountStanding>;
  /** Lookups the adapter and the selectors need; not part of the wire shape. */
  index: {
    unitById: Map<string, Unit>;
    unitContext: Map<string, UnitContext>;
    propertyById: Map<string, Property>;
    /** Every unit id beneath any asset id, at any level of the hierarchy. */
    unitIdsByAsset: Map<string, string[]>;
    specById: Map<string, UnitSpec>;
    propertySpecById: Map<string, PropertySpec>;
    /** D6 FR-53 — every unit standing in a designated space, so a caller
     *  never walks the tree to find out whether rung 4 is reachable. */
    healthSensitiveUnitIds: Set<string>;
  };
}

const assetRollUp = (unitSeverities: Severity[]) => ({
  severity: rollUp(unitSeverities),
  // D7 §4.2 — above the unit, the contributing count is always a count of
  // UNITS, so "2 of 14" means the same thing on a floor as on a property.
  contributing: countAtOrAbove(unitSeverities, 'unknown'),
  total: unitSeverities.length,
});

export const buildDataset = (now: Date): SimDataset => {
  const unitById = new Map<string, Unit>();
  const unitContext = new Map<string, UnitContext>();
  const propertyById = new Map<string, Property>();
  const unitIdsByAsset = new Map<string, string[]>();
  const specById = new Map<string, UnitSpec>();
  const propertySpecById = new Map<string, PropertySpec>();
  const alerts: Alert[] = [];
  const nameByAssetId = new Map<string, string>();
  const designationByRoomId = new Map<string, HealthSensitiveDesignation>();
  const roomIdByUnitId = new Map<string, string>();
  const healthSensitiveUnitIds = new Set<string>();

  const accounts = buildAccounts(now);

  const properties = PROPERTY_SPECS.map((pSpec): Property => {
    propertySpecById.set(pSpec.id, pSpec);
    nameByAssetId.set(pSpec.id, pSpec.name);
    const propertyUnitIds: string[] = [];
    const propertySeverities: Severity[] = [];

    const floors = pSpec.floors.map((fSpec): Floor => {
      const floorUnitIds: string[] = [];
      const floorSeverities: Severity[] = [];

      const rooms = fSpec.rooms.map((rSpec): Room => {
        const roomSeverities: Severity[] = [];
        nameByAssetId.set(rSpec.id, rSpec.name);
        // ADR-0015 OD-01 — the flag and the record behind it are authored
        // together; a flag with no record would be the self-declaration the
        // ADR rejected, wearing a different coat.
        const designation = rSpec.healthSensitiveRecord
          ? buildHealthSensitiveDesignation(rSpec.healthSensitiveRecord, now)
          : null;
        if (designation) designationByRoomId.set(rSpec.id, designation);

        const units = rSpec.units.map((uSpec): Unit => {
          nameByAssetId.set(uSpec.id, uSpec.name);
          roomIdByUnitId.set(uSpec.id, rSpec.id);
          if (rSpec.healthSensitive) healthSensitiveUnitIds.add(uSpec.id);
          const ctx: UnitContext = {
            now,
            propertyId: pSpec.id,
            floorId: fSpec.id,
            roomId: rSpec.id,
            healthSensitive: rSpec.healthSensitive ?? false,
          };
          const built = buildUnit(uSpec, ctx);
          unitById.set(built.unit.id, built.unit);
          unitContext.set(built.unit.id, ctx);
          specById.set(built.unit.id, uSpec);
          unitIdsByAsset.set(built.unit.id, [built.unit.id]);
          roomSeverities.push(built.unit.rollUp.severity);
          floorUnitIds.push(built.unit.id);
          propertyUnitIds.push(built.unit.id);

          // D7 §14.5 — planned service suppresses the ALERTS, never the
          // severity. The unit still reads grey; the queue simply does not
          // page anybody about a technician who is already standing there.
          if (!built.unit.device.maintenanceMode) {
            for (const fault of uSpec.faults ?? [])
              alerts.push(faultAlert(built, fault, ctx));
            if (built.unit.device.tamperSuspected) alerts.push(tamperAlert(built, ctx));
            if (built.blind) alerts.push(dataQualityAlert(built, ctx));
          }
          return built.unit;
        });

        unitIdsByAsset.set(
          rSpec.id,
          units.map((u) => u.id),
        );
        floorSeverities.push(...roomSeverities);
        return {
          id: rSpec.id,
          name: rSpec.name,
          nameKey: null,
          rollUp: assetRollUp(roomSeverities),
          units,
          healthSensitive: rSpec.healthSensitive ?? false,
          healthSensitiveDesignation: designation,
        };
      });

      unitIdsByAsset.set(fSpec.id, floorUnitIds);
      propertySeverities.push(...floorSeverities);
      return {
        id: fSpec.id,
        name: fSpec.name,
        nameKey: fSpec.nameKey ?? null,
        rollUp: assetRollUp(floorSeverities),
        rooms,
      };
    });

    unitIdsByAsset.set(pSpec.id, propertyUnitIds);
    const property: Property = {
      id: pSpec.id,
      name: pSpec.name,
      nameKey: null,
      rollUp: assetRollUp(propertySeverities),
      category: pSpec.category,
      floors,
    };
    propertyById.set(property.id, property);

    const standing = accounts[pSpec.id];
    if (standing && standing.state !== 'current') {
      alerts.push(paymentAlert(pSpec.id, standing));
    }
    return property;
  });

  alerts.push(...resolvedAlerts(now, unitContext));

  // The restriction in force on an account is the worst rung applied to any of
  // its units — derived, so it can never disagree with the unit banners. The
  // adapter re-runs the same fold after an approval moves a unit's rung.
  refreshAccountRestrictions(accounts, unitIdsByAsset, unitById);

  return {
    generatedAt: now.toISOString(),
    properties,
    alerts,
    maintenance: buildMaintenance(now),
    workOrders: buildWorkOrders({
      now,
      unitById,
      propertyById,
      alerts,
      roomIdByUnitId: new Map(
        [...unitContext].map(([unitId, ctx]) => [
          unitId,
          {
            floorId: ctx.floorId,
            roomId: ctx.roomId,
            healthSensitive: ctx.healthSensitive,
          },
        ]),
      ),
    }),
    restrictionRequests: buildRestrictionRequests({
      now,
      unitById,
      unitIdsByAsset,
      nameByAssetId,
      designationByRoomId,
      roomIdByUnitId,
      healthSensitiveUnitIds,
      accounts,
    }),
    accounts,
    index: {
      unitById,
      unitContext,
      propertyById,
      unitIdsByAsset,
      specById,
      propertySpecById,
      healthSensitiveUnitIds,
    },
  };
};

/** ACCESS re-exported so scoping reads from one place. */
export { ACCESS };
