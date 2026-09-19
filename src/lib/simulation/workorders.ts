/**
 * Work orders — one record, three views (D2 O-WO, O-WO.1 … O-WO.4).
 *
 * Two rules shape this file, and both are about the difference between a claim
 * and a fact.
 *
 * 1. **The stage is authored; the state is derived.** A fixture says how far a
 *    visit was taken — dispatched, working, closure submitted — and never what
 *    it ended as. Whether a submitted closure becomes `closed`, `reopened` or
 *    stays `awaitingVerification` is read out of the telemetry afterwards, so
 *    no fixture can claim a fix the readings contradict.
 * 2. **The post-service check re-reads the DEVICE, not the technician.** The
 *    measurement a technician records is a claim about the moment they stood
 *    there. The order settles on what the unit reports afterwards — and a unit
 *    that reports nothing settles nothing: that is `inconclusive`, not a pass
 *    (INV-GREY).
 *
 * @requirement FR-25 FR-32 FR-34
 */
import { SEVERITY } from '../domain/severity.ts';
import type { Severity } from '../domain/severity.ts';
import type { Role } from '../domain/role.ts';
import {
  partDefinition,
  partGroupLabelKey,
  partLabelKey,
  signalLabelKey,
} from './catalogue.ts';
import type { PartDefinition, SignalDefinition } from './catalogue.ts';
import { daysBefore, hoursAfter, hoursBefore } from './clock.ts';
import { TECHNICIANS, WORK_ORDER_SPECS } from './fixtures.ts';
import type { WorkOrderSpec } from './fixtures.ts';
import { links } from './links.ts';
import { SIMULATED_POLICY } from './policy.ts';
import { asReading } from './readings.ts';
import { createRng, round } from './random.ts';
import type {
  Alert,
  ChecklistEntry,
  ChecklistItem,
  ChecklistMeasurement,
  ClosureEntry,
  EscalationEntry,
  EvidencePhoto,
  FindingEntry,
  I18nKey,
  LimitDirection,
  Part,
  PartGroup,
  PostServiceVerification,
  Property,
  Reading,
  Unit,
  WorkOrder,
  WorkOrderAssignee,
  WorkOrderChecklistGroup,
  WorkOrderEvidence,
  WorkOrderFinding,
  WorkOrderPriority,
  WorkOrderResult,
  WorkOrderState,
  WorkOrderSummary,
} from './types.ts';

const PART_GROUPS: readonly PartGroup[] = ['indoor', 'outdoor', 'electrical'];

const simulated = (value: number | null, lastSeen: string | null): Reading => ({
  value,
  provenance: 'simulated',
  lastSeen,
});

const limitReading = (sig: SignalDefinition): Reading => simulated(sig.threshold, null);

/** Inside the limit on the side that matters. A superheat signal fails
 *  downward, so "smaller is better" is wrong for half the catalogue. */
const withinLimit = (
  value: number,
  limit: number,
  breaches: LimitDirection,
): boolean => (breaches === 'above' ? value <= limit : value >= limit);

const worstOf = (a: Severity, b: Severity): Severity =>
  SEVERITY[a].rank > SEVERITY[b].rank ? a : b;

/* ------------------------------------------------------------ the subject */

/**
 * The part and the signal a visit is about. The alert names it when there is
 * one; otherwise it is the unit's worst part, taken in catalogue order so the
 * choice is stable between runs.
 */
interface Subject {
  part: Part;
  def: PartDefinition;
  sig: SignalDefinition;
}

const subjectOf = (unit: Unit, focusPartId: string | null): Subject | null => {
  const part =
    (focusPartId ? unit.parts.find((p) => p.id === focusPartId) : undefined) ??
    unit.parts.reduce<Part | null>(
      (worst, p) =>
        worst === null || SEVERITY[p.severity].rank > SEVERITY[worst.severity].rank
          ? p
          : worst,
      null,
    );
  if (!part) return null;
  const def = partDefinition(part.id);
  return { part, def, sig: def.signals[0] };
};

/** What the device says now about the subject signal. */
const deviceReading = (part: Part): Reading | null =>
  part.signals.length === 0 ? null : asReading(part.signals[0].reading);

/* ---------------------------------------------------------------- checklist */

/**
 * O-WO.2 — the same twelve parts as the unit's health grid, in the same order,
 * grouped the way the work is done. Generated rather than authored: a
 * hand-written checklist is how the twelve become eleven on one screen.
 */
const buildChecklist = (
  order: { id: string },
  unit: Unit | null,
  focusPartId: string | null,
): WorkOrderChecklistGroup[] => {
  if (!unit) {
    // A whole-site preventive visit has no single unit to measure. An empty
    // checklist says so; inventing twelve steps against no unit would be a
    // record of work nobody can have done.
    return PART_GROUPS.map((group) => ({
      group,
      labelKey: partGroupLabelKey(group),
      items: [],
      recorded: 0,
      failed: 0,
      total: 0,
    }));
  }

  return PART_GROUPS.map((group) => {
    const items = unit.parts
      .filter((part) => part.group === group)
      .map((part): ChecklistItem => {
        const def = partDefinition(part.id);
        const sig = def.signals[0];
        const measurement: ChecklistMeasurement = {
          signalKey: signalLabelKey(part.id, sig.key),
          unit: sig.unit,
          limit: limitReading(sig),
          breaches: sig.direction,
          observed: null,
        };
        return {
          id: `${order.id}:${part.id}`,
          partId: part.id,
          group,
          labelKey: partLabelKey(part.id),
          measurement,
          result: 'pending',
          // A step that implicates a part is photographed; the rest are not,
          // because a checklist that demands twelve photos gets twelve photos
          // of the same wall.
          photoRequired: part.id === focusPartId || part.severity !== 'normal',
          photos: [],
          noteKey: null,
          recordedAt: null,
          recordedBy: null,
        };
      });
    return {
      group,
      labelKey: partGroupLabelKey(group),
      items,
      recorded: 0,
      failed: 0,
      total: items.length,
    };
  });
};

const recountChecklist = (order: WorkOrder): void => {
  for (const group of order.checklist) {
    group.recorded = group.items.filter((i) => i.result !== 'pending').length;
    group.failed = group.items.filter((i) => i.result === 'fail').length;
    group.total = group.items.length;
  }
};

const checklistTally = (order: WorkOrder) =>
  order.checklist.reduce(
    (t, g) => ({
      recorded: t.recorded + g.recorded,
      failed: t.failed + g.failed,
      total: t.total + g.total,
      pending: t.pending + (g.total - g.recorded),
    }),
    { recorded: 0, failed: 0, total: 0, pending: 0 },
  );

/**
 * The value a technician writes down. A pass is a measurement inside the
 * limit; a fail is what the device is reporting, because the point of a failed
 * step is that the two agree. Both are stamped `simulated` at the source.
 */
const recordedValue = (
  item: ChecklistItem,
  result: ChecklistEntry['result'],
  part: Part | undefined,
): number | null => {
  if (result === 'notApplicable' || !item.measurement) return null;
  const sig = partDefinition(item.partId).signals[0];
  if (result === 'fail') {
    const live = part ? deviceReading(part) : null;
    return (
      live?.value ??
      round(sig.nominal + 1.25 * (sig.threshold - sig.nominal), sig.decimals)
    );
  }
  const rng = createRng(`checklist:${item.id}`);
  return round(
    sig.nominal + rng.float(0, 0.35, 3) * (sig.threshold - sig.nominal),
    sig.decimals,
  );
};

const photo = (labelKey: I18nKey, at: string, seed: string): EvidencePhoto => ({
  id: `photo-${seed}`,
  labelKey,
  takenAt: at,
  mock: true,
});

const applyEntry = (
  item: ChecklistItem,
  entry: ChecklistEntry,
  part: Part | undefined,
  actorId: string,
  at: string,
): void => {
  item.result = entry.result;
  item.noteKey = entry.noteKey ?? null;
  item.recordedAt = at;
  item.recordedBy = actorId;
  if (item.measurement) {
    const value =
      entry.observedValue === undefined
        ? recordedValue(item, entry.result, part)
        : entry.observedValue;
    // Missing is not zero: a step nobody could measure keeps a null with the
    // time it was attempted, never a fabricated reading.
    item.measurement.observed = simulated(value, at);
  }
  for (const labelKey of entry.photoLabelKeys ?? []) {
    item.photos.push(photo(labelKey, at, `${item.id}:${item.photos.length}`));
  }
};

/* ----------------------------------------------------------- verification */

const verificationNoteKey = (state: PostServiceVerification['state']): I18nKey =>
  `workOrder.verification.${state}.note`;

/**
 * O-WO.4 — "prove the fix, do not assume it". `before` is the reading that
 * justified the visit; `after` is null until the check runs, and a Reading
 * whose VALUE is null when the check ran against a unit that is not talking.
 * Those two nulls mean different things and the UI must be able to tell them
 * apart.
 */
const startVerification = (
  unit: Unit,
  focusPartId: string | null,
  alert: Alert | null,
  order: WorkOrder,
  closedAt: string,
): PostServiceVerification | null => {
  const subject = subjectOf(unit, focusPartId);
  if (!subject) return null;
  const signalKey = signalLabelKey(subject.part.id, subject.sig.key);
  const fromAlert =
    alert?.evidence.find((e) => e.signalKey === signalKey)?.observed ?? null;
  const fromChecklist =
    order.checklist.flatMap((g) => g.items).find((i) => i.partId === subject.part.id)
      ?.measurement?.observed ?? null;
  return {
    state: 'scheduled',
    partId: subject.part.id,
    signalKey,
    unit: subject.sig.unit,
    limit: limitReading(subject.sig),
    breaches: subject.sig.direction,
    // No recorded before-reading is stated as none. It is not the threshold,
    // and it is certainly not zero.
    before: fromAlert ?? fromChecklist ?? simulated(null, order.openedAt),
    after: null,
    dueAt: hoursAfter(new Date(closedAt), SIMULATED_POLICY.postServiceWindowHours),
    checkedAt: null,
    noteKey: verificationNoteKey('scheduled'),
  };
};

const runVerification = (
  verification: PostServiceVerification,
  unit: Unit,
  at: string,
): PostServiceVerification => {
  const part = unit.parts.find((p) => p.id === verification.partId);
  const after = part ? deviceReading(part) : null;
  const state: PostServiceVerification['state'] =
    after === null || after.value === null
      ? 'inconclusive'
      : withinLimit(after.value, verification.limit.value ?? 0, verification.breaches)
        ? 'passed'
        : 'failed';
  return {
    ...verification,
    state,
    // `after` keeps its last-seen time even when the value is null, so the
    // screen can say how long the silence has lasted.
    after: after ?? simulated(null, unit.device.lastHeartbeat),
    checkedAt: at,
    noteKey: verificationNoteKey(state),
  };
};

const stateAfterVerification = (v: PostServiceVerification | null): WorkOrderState => {
  if (!v) return 'closed';
  if (v.state === 'passed') return 'closed';
  if (v.state === 'failed') return 'reopened';
  return 'awaitingVerification';
};

/* ------------------------------------------------------------- derivation */

const priorityOf = (severity: Severity): WorkOrderPriority => {
  if (severity === 'critical') return 'urgent';
  // Grey is not routine. We do not know what is wrong with a unit we cannot
  // see, and "we do not know" is not a reason to leave it a week (INV-GREY).
  if (severity === 'warning' || severity === 'unknown') return 'high';
  return 'routine';
};

const assigneeOf = (userId: string | undefined): WorkOrderAssignee | null => {
  const found = TECHNICIANS.find((t) => t.id === userId);
  return found ? { id: found.id, name: found.name, role: found.role } : null;
};

const transition = (
  order: WorkOrder,
  to: WorkOrderState,
  at: string,
  actorId: string,
  reasonKey: I18nKey | null = null,
): void => {
  order.history.push({ at, from: order.state, to, actorId, reasonKey });
  order.state = to;
};

const evidenceOf = (
  alert: Alert | null,
  unit: Unit | null,
  suspectedPartIds: string[],
): WorkOrderEvidence => {
  const reporting = unit ? unit.device.online : true;
  const groups = new Set<PartGroup>();
  for (const partId of suspectedPartIds) groups.add(partDefinition(partId).group);
  const lastSeen = unit?.device.lastHeartbeat ?? null;
  const readingsMissing =
    unit !== null &&
    unit.parts.every((p) => (deviceReading(p)?.value ?? null) === null);
  return {
    alertId: alert?.id ?? null,
    raisedAt: alert?.raisedAt ?? null,
    signals: alert?.evidence ?? [],
    partGroups: [...groups],
    projection: alert?.projection ?? null,
    // A preventive visit predicted nothing. That is null, not a confidence
    // of zero, which would read as "certainly not".
    confidence: alert?.confidence ?? null,
    dataQuality: {
      reporting: reporting && !readingsMissing,
      lastSeen,
      noteKey:
        reporting && !readingsMissing
          ? 'workOrder.dataQuality.reporting'
          : 'workOrder.dataQuality.notReporting',
    },
    provenance: 'simulated',
  };
};

/** D6 FR-25 — disproving a prediction downgrades it. A sensor fault says the
 *  measurement was wrong, which disproves the fault just as squarely as
 *  finding the part healthy does. */
const downgradesPrediction = (verdict: WorkOrderFinding['verdict']): boolean =>
  verdict === 'notConfirmed' || verdict === 'sensorFault';

const findingFor = (
  order: WorkOrder,
  alert: Alert | null,
  spec: WorkOrderSpec,
  at: string,
): WorkOrderFinding => {
  // A visit that went out on a data-quality alert did not find a broken part;
  // it found a unit nobody could see. Recording that as `confirmed` would put
  // a mechanical fault in the history of a unit that may not have one.
  const verdict: WorkOrderFinding['verdict'] =
    alert === null
      ? 'notConfirmed'
      : alert.category === 'dataQuality'
        ? 'dataQualityIssue'
        : 'confirmed';
  return {
    id: `${order.id}-finding-1`,
    partId: alert?.scope.partId ?? null,
    verdict,
    noteKey: `workOrder.finding.${verdict}.note`,
    partsUsed: (spec.partsUsed ?? []).map((p) => ({
      sku: p.sku,
      labelKey: `workOrder.part.${p.sku}`,
      quantity: p.quantity,
    })),
    photos: [photo('workOrder.photo.afterService', at, `${order.id}:finding`)],
    recordedAt: at,
    recordedBy: spec.assignedTo ?? 'user-tech',
    downgradesAlert: downgradesPrediction(verdict),
  };
};

export interface WorkOrderInputs {
  now: Date;
  unitById: ReadonlyMap<string, Unit>;
  propertyById: ReadonlyMap<string, Property>;
  alerts: readonly Alert[];
  /** Room ids, so an order carries the same AssetRef the alert does. */
  roomIdByUnitId: ReadonlyMap<
    string,
    { floorId: string; roomId: string; healthSensitive: boolean }
  >;
}

/**
 * Specs → work orders. Everything below the stage is derived from the same
 * units and alerts every other screen reads, so the technician's view of a
 * fault and the client's cannot disagree.
 */
export const buildWorkOrders = (input: WorkOrderInputs): WorkOrder[] =>
  WORK_ORDER_SPECS.map((spec) => buildWorkOrder(spec, input));

const buildWorkOrder = (spec: WorkOrderSpec, input: WorkOrderInputs): WorkOrder => {
  const { now } = input;
  const unit = spec.unitId ? (input.unitById.get(spec.unitId) ?? null) : null;
  const where = spec.unitId ? (input.roomIdByUnitId.get(spec.unitId) ?? null) : null;
  const alert = spec.alertId
    ? (input.alerts.find((a) => a.id === spec.alertId) ?? null)
    : null;
  const focusPartId = alert?.scope.partId ?? null;
  const openedAt = daysBefore(now, spec.openedDaysAgo);

  const severity: Severity = alert
    ? alert.severity
    : unit
      ? unit.rollUp.severity
      : 'normal';
  const priority = priorityOf(severity);
  const kind =
    spec.origin === 'preventiveSchedule'
      ? 'preventiveVisit'
      : spec.origin === 'tamper'
        ? 'inspection'
        : 'repair';

  const suspectedPartIds = focusPartId
    ? [focusPartId]
    : unit
      ? unit.parts.filter((p) => p.suspected).map((p) => p.id)
      : [];

  const order: WorkOrder = {
    id: spec.id,
    state: 'dispatched',
    priority,
    severity,
    kind,
    // The timeline already owns these words (FR-33); a second key for the same
    // visit is how two screens come to call one job two things.
    titleKey: `maintenance.${kind}.title`,
    scope: {
      propertyId: spec.propertyId,
      floorId: where?.floorId,
      roomId: where?.roomId,
      unitId: spec.unitId,
      partId: focusPartId ?? undefined,
    },
    unitName: unit?.name ?? null,
    assignedTo: assigneeOf(spec.assignedTo),
    openedAt,
    slaDueAt: hoursAfter(
      new Date(openedAt),
      SIMULATED_POLICY.workOrderSlaHours[priority],
    ),
    maintenanceEventId: spec.maintenanceEventId ?? null,
    brief: {
      summaryKey: `workOrder.brief.${spec.origin}`,
      origin: spec.origin,
      alertId: alert?.id ?? null,
      suspected: alert?.suspected ?? false,
      suspectedPartIds,
      healthSensitive: where?.healthSensitive ?? false,
      restrictionStep: unit?.restriction?.step ?? null,
      accessNoteKey: where?.healthSensitive
        ? 'workOrder.access.healthSensitive'
        : unit?.restriction
          ? 'workOrder.access.restricted'
          : null,
    },
    evidence: evidenceOf(alert, unit, suspectedPartIds),
    checklist: buildChecklist(spec, unit, focusPartId),
    findings: [],
    closure: null,
    verification: null,
    history: [
      {
        at: openedAt,
        from: null,
        to: 'dispatched',
        actorId: 'user-admin',
        reasonKey: null,
      },
    ],
    // Replaced per caller in `viewFor` — a work order has one address per role.
    action: {
      labelKey: 'workOrder.action.perform',
      href: links.workOrder('admin', spec.id),
    },
    provenance: 'simulated',
  };

  seedStage(order, spec, unit, alert, input);
  recountChecklist(order);
  return order;
};

/** Replays the visit up to its authored stage, in the order it happened. */
const seedStage = (
  order: WorkOrder,
  spec: WorkOrderSpec,
  unit: Unit | null,
  alert: Alert | null,
  input: WorkOrderInputs,
): void => {
  const { now } = input;
  const actorId = spec.assignedTo ?? 'user-tech';
  if (spec.stage === 'dispatched') return;

  transition(order, 'accepted', hoursAfter(new Date(order.openedAt), 1), actorId);
  if (spec.stage === 'accepted') return;

  const startedAt = hoursAfter(new Date(order.openedAt), 2);
  transition(order, 'inProgress', startedAt, actorId);

  const focusPartId = alert?.scope.partId ?? null;
  const items = order.checklist.flatMap((g) => g.items);
  const partOf = (partId: string) => unit?.parts.find((p) => p.id === partId);

  /**
   * A step against a channel that is reporting nothing is `notApplicable` with
   * a note — never a pass. Nobody measured anything, and a checklist of passes
   * over a silent unit is the most convincing wrong record the product could
   * produce (INV-NO-FABRICATION).
   */
  const record = (item: ChecklistItem): void => {
    const live = partOf(item.partId);
    const measurable = live ? deviceReading(live)?.value !== null : false;
    const failing = item.partId === focusPartId;
    applyEntry(
      item,
      measurable
        ? {
            result: failing ? 'fail' : 'pass',
            photoLabelKeys: [`workOrder.photo.${item.partId}`],
          }
        : { result: 'notApplicable', noteKey: 'workOrder.note.unitNotReporting' },
      live,
      actorId,
      startedAt,
    );
  };

  if (spec.stage === 'working' || spec.stage === 'escalated') {
    // Part-way through: the group the alert implicates has been worked, the
    // rest has not. A half-recorded checklist is the state a technician is
    // actually looking at, and it is the one screens forget to design for.
    const focusGroup = focusPartId ? partDefinition(focusPartId).group : 'indoor';
    for (const item of items.filter((i) => i.group === focusGroup)) record(item);
  } else {
    for (const item of items) record(item);
  }
  recountChecklist(order);

  if (spec.stage === 'escalated') {
    const at = hoursAfter(new Date(order.openedAt), 3);
    order.findings.push(findingFor(order, alert, spec, at));
    order.closure = {
      outcome: 'escalated',
      summaryKey: 'workOrder.closure.escalated.summary',
      closedAt: at,
      closedBy: actorId,
      escalationReasonKey:
        spec.escalationReasonKey ?? 'workOrder.escalation.specialistRequired',
      clientConfirmation: { state: 'notRequested', at: null },
      noVerificationReasonKey: 'workOrder.verification.notApplicable.escalated',
    };
    transition(order, 'escalated', at, actorId, order.closure.escalationReasonKey);
    return;
  }

  if (spec.stage !== 'closureSubmitted') return;

  const closedAt = hoursBefore(now, spec.closedHoursAgo ?? 1);
  order.findings.push(findingFor(order, alert, spec, closedAt));
  order.closure = {
    outcome: (spec.partsUsed ?? []).length > 0 ? 'repaired' : 'noFaultFound',
    summaryKey: `workOrder.closure.${(spec.partsUsed ?? []).length > 0 ? 'repaired' : 'noFaultFound'}.summary`,
    closedAt,
    closedBy: actorId,
    escalationReasonKey: null,
    clientConfirmation: {
      state: (spec.closedHoursAgo ?? 0) > 72 ? 'confirmed' : 'requested',
      at: closedAt,
    },
    noVerificationReasonKey: unit ? null : 'workOrder.verification.notApplicable.site',
  };
  transition(order, 'awaitingVerification', closedAt, actorId);

  if (!unit) {
    // Nothing to re-measure. Stating that is honest; running a check against
    // no signal and calling it a pass would not be.
    transition(
      order,
      'closed',
      closedAt,
      actorId,
      order.closure.noVerificationReasonKey,
    );
    return;
  }

  order.verification = startVerification(unit, focusPartId, alert, order, closedAt);
  if (!order.verification) return;
  if (Date.parse(order.verification.dueAt) > now.getTime()) return;

  order.verification = runVerification(
    order.verification,
    unit,
    order.verification.dueAt,
  );
  const next = stateAfterVerification(order.verification);
  if (next !== order.state) {
    transition(
      order,
      next,
      order.verification.checkedAt ?? closedAt,
      'system',
      `workOrder.verification.${order.verification.state}.reason`,
    );
  }
};

/* ------------------------------------------------------------ transitions */

const reject = (reasonKey: I18nKey): WorkOrderResult => ({ ok: false, reasonKey });

const isSettled = (order: WorkOrder): boolean =>
  order.state === 'closed' ||
  order.state === 'escalated' ||
  order.state === 'awaitingVerification';

const startWorking = (order: WorkOrder, at: string, actorId: string): void => {
  if (
    order.state === 'dispatched' ||
    order.state === 'accepted' ||
    order.state === 'reopened'
  ) {
    transition(order, 'inProgress', at, actorId);
  }
};

export const applyChecklistEntry = (
  order: WorkOrder,
  unit: Unit | null,
  itemId: string,
  entry: ChecklistEntry,
  actorId: string,
  at: string,
): WorkOrderResult => {
  if (isSettled(order)) return reject('workOrder.reject.alreadyClosed');
  const item = order.checklist.flatMap((g) => g.items).find((i) => i.id === itemId);
  if (!item) return reject('workOrder.reject.unknownItem');
  applyEntry(
    item,
    entry,
    unit?.parts.find((p) => p.id === item.partId),
    actorId,
    at,
  );
  startWorking(order, at, actorId);
  recountChecklist(order);
  return { ok: true, order };
};

/**
 * D6 FR-25 — the verdict that ends "suspected". `notConfirmed` and
 * `sensorFault` also downgrade the prediction: the model was wrong, and the
 * alert stops being presented as a fault waiting to happen.
 */
export const applyFinding = (
  order: WorkOrder,
  finding: FindingEntry,
  actorId: string,
  at: string,
): WorkOrderResult => {
  if (isSettled(order)) return reject('workOrder.reject.alreadyClosed');
  order.findings.push({
    id: `${order.id}-finding-${order.findings.length + 1}`,
    partId: finding.partId ?? null,
    verdict: finding.verdict,
    noteKey: finding.noteKey,
    partsUsed: (finding.partsUsed ?? []).map((p) => ({
      sku: p.sku,
      labelKey: `workOrder.part.${p.sku}`,
      quantity: p.quantity,
    })),
    photos: (finding.photoLabelKeys ?? []).map((k, i) =>
      photo(k, at, `${order.id}:finding:${order.findings.length}:${i}`),
    ),
    recordedAt: at,
    recordedBy: actorId,
    downgradesAlert: downgradesPrediction(finding.verdict),
  });
  order.brief.suspected = false;
  startWorking(order, at, actorId);
  return { ok: true, order };
};

export const applyClosure = (
  order: WorkOrder,
  unit: Unit | null,
  alert: Alert | null,
  closure: ClosureEntry,
  actorId: string,
  at: string,
): WorkOrderResult => {
  if (isSettled(order)) return reject('workOrder.reject.alreadyClosed');
  const tally = checklistTally(order);
  if (tally.pending > 0) return reject('workOrder.reject.checklistIncomplete');
  // A step still reading outside its limit is not a closure, it is an
  // escalation. Closing over it is how "fixed" stops meaning anything.
  if (tally.failed > 0) return reject('workOrder.reject.itemFailed');
  if (order.findings.length === 0) return reject('workOrder.reject.findingRequired');

  order.closure = {
    outcome: closure.outcome,
    summaryKey: closure.summaryKey,
    closedAt: at,
    closedBy: actorId,
    escalationReasonKey: null,
    clientConfirmation: {
      state: closure.requestClientConfirmation ? 'requested' : 'notRequested',
      at: closure.requestClientConfirmation ? at : null,
    },
    noVerificationReasonKey: unit ? null : 'workOrder.verification.notApplicable.site',
  };
  transition(order, 'awaitingVerification', at, actorId);
  order.verification = unit
    ? startVerification(unit, alert?.scope.partId ?? null, alert, order, at)
    : null;
  if (!unit)
    transition(order, 'closed', at, actorId, order.closure.noVerificationReasonKey);
  return { ok: true, order };
};

export const applyEscalation = (
  order: WorkOrder,
  escalation: EscalationEntry,
  actorId: string,
  at: string,
): WorkOrderResult => {
  if (isSettled(order)) return reject('workOrder.reject.alreadyClosed');
  order.closure = {
    outcome: 'escalated',
    summaryKey: 'workOrder.closure.escalated.summary',
    closedAt: at,
    closedBy: actorId,
    escalationReasonKey: escalation.reasonKey,
    clientConfirmation: { state: 'notRequested', at: null },
    noVerificationReasonKey: 'workOrder.verification.notApplicable.escalated',
  };
  transition(order, 'escalated', at, actorId, escalation.reasonKey);
  return { ok: true, order };
};

export const applyPostServiceCheck = (
  order: WorkOrder,
  unit: Unit | null,
  at: string,
): WorkOrderResult => {
  if (order.state !== 'awaitingVerification' || !order.verification) {
    return reject('workOrder.reject.notClosed');
  }
  if (!unit) return reject('workOrder.reject.notClosed');
  order.verification = runVerification(order.verification, unit, at);
  const next = stateAfterVerification(order.verification);
  if (next !== order.state) {
    transition(
      order,
      next,
      at,
      'system',
      `workOrder.verification.${order.verification.state}.reason`,
    );
  }
  return { ok: true, order };
};

/* ------------------------------------------------------------- role views */

const actionFor = (role: Role, order: WorkOrder) => ({
  labelKey:
    role === 'client'
      ? 'workOrder.action.track'
      : role === 'admin'
        ? 'workOrder.action.dispatch'
        : order.state === 'closed'
          ? 'workOrder.action.view'
          : 'workOrder.action.perform',
  href: links.workOrder(role, order.id, order.maintenanceEventId),
});

/** One record, one address per role (D2 O-WO). The object is the same; where
 *  it opens is not, because a client has no work queue to open it in. */
export const viewFor = (role: Role, order: WorkOrder): WorkOrder => ({
  ...structuredClone(order),
  action: actionFor(role, order),
});

export const summaryFor = (role: Role, order: WorkOrder): WorkOrderSummary => {
  const tally = checklistTally(order);
  return {
    id: order.id,
    state: order.state,
    priority: order.priority,
    severity: order.severity,
    kind: order.kind,
    titleKey: order.titleKey,
    scope: { ...order.scope },
    unitName: order.unitName,
    assignedTo: order.assignedTo ? { ...order.assignedTo } : null,
    openedAt: order.openedAt,
    slaDueAt: order.slaDueAt,
    suspected: order.brief.suspected,
    checklist: { recorded: tally.recorded, failed: tally.failed, total: tally.total },
    verification: order.verification?.state ?? null,
    action: actionFor(role, order),
    provenance: order.provenance,
  };
};

/** The worst severity across a set of orders, for a dispatch board header. */
export const worstWorkOrderSeverity = (orders: readonly WorkOrder[]): Severity =>
  orders.reduce<Severity>((worst, o) => worstOf(worst, o.severity), 'normal');
