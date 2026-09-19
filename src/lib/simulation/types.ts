/**
 * Simulated telemetry adapter — the Phase 1B seam.
 *
 * ADR-0004: this interface is written BEFORE the data, so it is shaped by the
 * eventual API rather than by whatever the first screen found convenient.
 * Phase 1B swaps the implementation; the screens must not change.
 *
 * Every value carries `provenance` stamped AT THE SOURCE. Provenance is a
 * property of the value, not a decoration the UI adds — otherwise aggregates
 * cannot compute their own and every new screen is a fresh chance to forget.
 *
 * @requirement FR-15 FR-60
 */
import type { RollUp, Severity } from '../domain/severity.ts';
import type { Provenance } from '../domain/provenance.ts';
import type { CommandState } from '../domain/command.ts';
import type { RestrictionStep } from '../domain/restriction.ts';
import type { ComfortVerdict } from '../domain/comfort.ts';
import type { Role } from '../domain/role.ts';

/** An i18n key. The adapter never emits display text — the locale pack owns
 *  every word (D5 UR-LANG-01). Free-text names (a room a person typed) are the
 *  documented exception and travel as `name`. */
export type I18nKey = string;

/**
 * The core wrapper. A reading is never a bare number, because a bare number
 * cannot answer "how do you know?" or "when was this?".
 *
 * `value: null` means NOT REPORTED. It is never coerced to 0 — "missing is not
 * zero" (D7 §11.2). When null, `lastSeen` says when the value was last real.
 */
export interface Reading<T = number> {
  value: T | null;
  provenance: Provenance;
  /** ISO 8601. Required when `value` is null. */
  lastSeen: string | null;
}

/** A sensor that is not fitted is STATED AS ABSENT, not shown as empty
 *  (D6 FR-63). This is distinct from a fitted sensor that has gone quiet. */
export interface AbsentSensor {
  kind: 'absent';
  sensorKey: string;
}

export type MaybeReading<T = number> = Reading<T> | AbsentSensor;

/* ------------------------------------------------------------------ assets */

export type Category = 'home' | 'office';

export interface AssetNode {
  id: string;
  nameKey: string | null;
  /** Free-text names come from data, not locale packs; `nameKey` is for
   *  system-generated names such as "Floor 1". */
  name: string;
  /**
   * D7 §4.2 — worst status of children, with the contributing count so the
   * roll-up is inspectable rather than a bare colour. Produced by
   * `rollUpWithCount()`; every level counts LEAF UNITS, so "2 of 14 need
   * attention" means the same thing on a room row and on a property card.
   * A unit counts its twelve parts plus device trust.
   */
  rollUp: RollUp;
}

export interface Property extends AssetNode {
  category: Category;
  floors: Floor[];
}
export interface Floor extends AssetNode {
  rooms: Room[];
}
/**
 * ADR-0015 OD-01 — the health-sensitive designation is a REQUEST-AND-REVIEW
 * RECORD, not a self-declaration and not an HQ-only switch.
 *
 * The client or an on-site technician requests it with evidence, HQ approves
 * it, and it carries a review date. Self-service would fail open (anyone
 * facing restriction opts out of rung 4 for free and the guarantee is
 * decorative); HQ-only would fail closed (an infant or an oxygen concentrator
 * has no route in). This shape fails *slow* — the worst case is a queue.
 *
 * The review date is what stops a flag becoming permanent furniture: a
 * designation with no expiry is indistinguishable from a 2026 mis-tag nobody
 * ever looked at again.
 */
export interface HealthSensitiveDesignation {
  requestedBy: { id: string; name: string; role: Role };
  requestedAt: string;
  /** The locale pack owns the words. Evidence travels as a key, never as a
   *  sentence the simulator wrote. */
  evidenceKey: I18nKey;
  approvedBy: { id: string; name: string };
  approvedAt: string;
  /** ISO 8601 — when the designation must be looked at again. */
  reviewBy: string;
}

export interface Room extends AssetNode {
  units: Unit[];
  /** D6 FR-53 — blocks the `stop` rung of the restriction ladder. */
  healthSensitive: boolean;
  /** ADR-0015 OD-01 — the record behind the flag. `null` when the room is not
   *  designated; the boolean above stays the thing callers test, so nothing
   *  has to walk a record to find out whether rung 4 is reachable. */
  healthSensitiveDesignation: HealthSensitiveDesignation | null;
}

/* ------------------------------------------------------------------- units */

export type PartGroup = 'indoor' | 'outdoor' | 'electrical';

/** One of the twelve monitored components (D6 FR-20). */
export interface Part {
  id: string;
  group: PartGroup;
  /** The locale pack owns the words. `id` is the canonical part id from
   *  `requirements.json → monitoredParts`; this is how a screen asks for its
   *  name without building the key itself. */
  labelKey: I18nKey;
  severity: Severity;
  /** D6 FR-25 — suspected until a technician verdict. */
  suspected: boolean;
  /** `key` is a locale key — `signal.pressureDrop`. */
  signals: { key: I18nKey; reading: MaybeReading }[];
}

/** The live sensor channels a split unit may carry. Not every unit has every
 *  one — a channel that is not fitted is an `AbsentSensor`, not a blank. */
export const SENSOR_KEYS = [
  'temperatureC',
  'humidityPct',
  'powerW',
  'energyTodayKWh',
  'co2Ppm',
  'pm25',
] as const;

export type SensorKey = (typeof SENSOR_KEYS)[number];

/** D6 FR-63 — naming an absent sensor is a locale lookup, not a sentence the
 *  screen assembles. Mirrors `comfortLabelKey` in `lib/domain`. */
export const sensorLabelKey = (sensorKey: SensorKey): I18nKey => `sensor.${sensorKey}`;

export type LiveReadings = Record<SensorKey, MaybeReading>;

export interface Unit extends AssetNode {
  brand: string;
  parts: Part[];
  live: LiveReadings;
  control: {
    mode: 'cool' | 'fan' | 'eco' | 'off';
    setpointC: number;
    fanSpeed: 1 | 2 | 3 | 'auto';
    lastCommand: { state: CommandState; at: string } | null;
  };
  /** D7 §14.5 — device trust. Tamper is its own category, not a fault. */
  device: {
    online: boolean;
    lastHeartbeat: string | null;
    tamperSuspected: boolean;
    maintenanceMode: boolean;
  };
  restriction: UnitRestriction | null;
}

/**
 * D7 §13.2 — a restriction is a governed process, so the data carries what the
 * banner must show: which rung, why, how long is left and who signed it off.
 * A step without its grace period and its dual approval is a threat, not a
 * process, and the shape is what stops one being rendered.
 */
export interface UnitRestriction {
  step: RestrictionStep;
  reasonKey: I18nKey;
  graceEndsAt: string;
  /**
   * D6 §10 — dual approval at every step, shown to Admin.
   *
   * ADR-0015 OD-02 reads "dual" as two-person control: requester plus ONE
   * independent approver, which is what this shape already encoded. Rung 4
   * (`stop`) additionally carries a named management sign-off, so `signedOff`
   * is optional and present only when `step === 'stop'`.
   */
  approval: {
    requester: string;
    approver: string;
    at: string;
    signedOff?: { manager: string; at: string };
  };
  /** D6 FR-53 — mirrors the room's flag onto the unit so a caller deciding
   *  whether the next rung is reachable does not have to walk back up the
   *  tree. `stop` is never permitted when this is true. */
  healthSensitive: boolean;
}

/* --------------------------------------------- restriction approval queue */

/** `pending` is waiting on a decision; the other two carry a `decision`. */
export type RestrictionRequestState = 'pending' | 'approved' | 'declined';

/**
 * What justifies moving an account down a rung. Readings rather than
 * pre-formatted strings, so the figure carries its own provenance and the
 * locale does the formatting (D7 §6.5) — and so an approver is looking at the
 * same balance the billing screen shows.
 */
export interface RestrictionRequestEvidence {
  balanceIdr: Reading;
  dueAt: string;
  /** Whole days past the due date at the time of the request. */
  daysOverdue: number;
  /** D6 FR-51 MOCKED — the notices already delivered. "We told them" is
   *  evidence of consent; an empty list is evidence there is none. */
  notices: AlertDelivery[];
}

/** The outcome, kept as a record rather than a flag: P-APPROVE shows who
 *  decided, when, and on what grounds, and an audit is not reconstructable
 *  from a boolean. */
export interface RestrictionDecision {
  outcome: 'approved' | 'declined';
  decidedBy: string;
  decidedAt: string;
  /** Why. Required on a decline; carried on an approval when there is a note. */
  reasonKey: I18nKey | null;
  /** ADR-0015 OD-02 — present only on an approved `stop`. */
  signedOff: { manager: string; at: string } | null;
}

/**
 * P-APPROVE's whole subject: an ask to move a named space one rung down the
 * ladder, with everything the approver needs to answer it.
 *
 * ADR-0015 made this buildable. Before it, `admin.restriction-case` had to say
 * "the dataset holds no pending requests" — which was true, and which is why
 * the decision flow could not be built without inventing an inbox.
 *
 * @requirement FR-52
 */
export interface RestrictionRequest {
  id: string;
  state: RestrictionRequestState;
  /** Which space. May name a unit, a room or a whole property. */
  scope: AssetRef;
  /** Names people typed, so they travel as text rather than as keys. */
  propertyName: string;
  spaceName: string;
  /** The rung in force on the affected units now — `null` when the ladder has
   *  not started. Not a step count: a request must name where it starts. */
  currentStep: RestrictionStep | null;
  requestedStep: RestrictionStep;
  reasonKey: I18nKey;
  evidenceSummaryKey: I18nKey;
  evidence: RestrictionRequestEvidence;
  requestedBy: { id: string; name: string; role: Role };
  requestedAt: string;
  /**
   * D6 FR-53 — the check the approver must SEE before deciding, carried on the
   * request so no screen recomputes it and no screen can skip it. True when
   * any affected space is designated.
   */
  healthSensitive: boolean;
  /** The record behind that flag (ADR-0015 OD-01), or `null`. */
  healthSensitiveDesignation: HealthSensitiveDesignation | null;
  /** `isStepPermitted(requestedStep, { healthSensitive })`, precomputed. When
   *  false the request is refusable on sight and the adapter will refuse it. */
  permitted: boolean;
  /** ADR-0015 OD-02 — true on rung 4, where a named manager must sign. */
  requiresManagementSignOff: boolean;
  /** The grace period the rung would carry if approved, in hours. */
  graceHours: number;
  /** When the request lapses unactioned. A queue with no expiry is a backlog. */
  expiresAt: string;
  decision: RestrictionDecision | null;
  action: ActionRef;
  provenance: Provenance;
}

/** What an approver submits. `approve` goes through `isStepPermitted()` in the
 *  adapter, which is why there is no "force" flag here. */
export interface RestrictionDecisionEntry {
  outcome: 'approve' | 'decline';
  /** Required on a decline — an approver who refuses says why. */
  reasonKey?: I18nKey | null;
  /** ADR-0015 OD-02 — a named manager. Required to approve `stop`. */
  signedOffBy?: string | null;
  /** The deciding person's display name, for the audit line. `DataScope`
   *  carries only an id, and "approved by user-admin" is not a decision
   *  record. Falls back to the scope's id when omitted. */
  decidedByName?: string | null;
}

/** Same shape as `WorkOrderResult`: a refusal is DATA, not an exception, and
 *  the caller renders `reasonKey` rather than inventing the sentence. */
export type RestrictionRequestResult =
  { ok: true; request: RestrictionRequest } | { ok: false; reasonKey: I18nKey };

/* ------------------------------------------------------------------ energy */

export interface EnergySeries {
  actual: { t: string; kWh: number }[];
  /** The counterfactual: what the unit WOULD have consumed. */
  baseline: { t: string; kWh: number }[];
  /** D6 FR-61 — the method is published, versioned and dated inside the
   *  product; the chart is not permitted without a link to it. */
  method: { id: string; version: string; href: string };
  /** Below 90 % makes a derived MRV package provisional (D6 FR-71). */
  completeness: number;
  provenance: Provenance;
  /** D6 FR-62 — savings attributed to the lever that produced them. */
  levers: { key: string; kWh: number }[];
}

export interface CarbonSummary {
  scope2KgCO2e: Reading;
  avoidedKgCO2e: Reading;
  /** D6 FR-70 — displayed, never hidden. */
  gridFactor: GridFactor;
}

/** D6 FR-70 / FR-101 — a versioned table with an effective date. `source` is
 *  a published proper noun, which is why it is not an i18n key. */
export interface GridFactor {
  value: number;
  unit: 'kgCO2e/kWh';
  source: string;
  effectiveFrom: string;
}

/* ------------------------------------------------------------------ alerts */

/**
 * D7 §14.5 — tamper is `critical` severity but a DIFFERENT CATEGORY from a
 * mechanical fault, with its own icon and its own filter. It does not dissolve
 * into the maintenance queue, because the technician dispatched for it needs
 * different information.
 */
export type AlertCategory = 'fault' | 'tamper' | 'dataQuality' | 'payment';

/** D2 C-3 — one attention queue, grouped by what the reader must do next. */
export type AlertState = 'needsAction' | 'watching' | 'resolved';

/**
 * D6 FR-20 — the two classes of signal render differently. `acute` names the
 * measurement that breached; `slow` is reported as a trend with a projected
 * failure date and a confidence band, never as a threshold breach.
 */
export type SignalClass = 'acute' | 'slow';

/**
 * D6 FR-21 — evidence is signals, thresholds and duration. `observed` and
 * `threshold` are Readings rather than pre-formatted strings so the figure
 * carries its own provenance and the locale does the formatting (D7 §6.5).
 */
export interface AlertEvidence {
  signalKey: I18nKey;
  observed: Reading;
  threshold: Reading;
  /** The SI symbol, not localised; the surrounding label is. */
  unit: string;
  /** ISO 8601 — when the condition began. The UI renders the duration from
   *  this against now, rather than storing a stale "for 3 days". */
  since: string;
}

/**
 * D6 FR-62 slow signals — a projection, with the band that makes it honest.
 * A date without a band reads as a promise.
 */
export interface FailureProjection {
  failureBy: string;
  confidenceBand: { earliest: string; latest: string };
  provenance: Provenance;
}

/** Where an alert sits in the hierarchy. Every level is optional below the
 *  property because a payment alert has no part and a data-quality alert may
 *  concern a whole floor. */
export interface AssetRef {
  propertyId: string;
  floorId?: string;
  roomId?: string;
  unitId?: string;
  partId?: string;
}

/** D5 acceptance principle 3 / INV-NO-DEAD-END — an alert without an action
 *  is a dead end, so the action is part of the alert, not part of the screen. */
export interface ActionRef {
  labelKey: I18nKey;
  href: string;
}

/** D6 FR-22 MOCKED in 1A — the delivery state of the notice that carried the
 *  alert, so "we told them" is distinguishable from "they saw it". */
export interface AlertDelivery {
  channel: 'inApp' | 'push' | 'whatsapp' | 'email';
  state: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  at: string;
}

/**
 * @requirement FR-21 FR-25
 */
export interface Alert {
  id: string;
  severity: Severity;
  category: AlertCategory;
  state: AlertState;
  /** D6 FR-25 — a prediction is SUSPECTED until a technician verdict, and
   *  renders as a dashed border rather than a fifth colour. */
  suspected: boolean;
  signalClass: SignalClass;
  scope: AssetRef;
  titleKey: I18nKey;
  likelyCauseKey: I18nKey;
  impactIfIgnoredKey: I18nKey;
  recommendedAction: ActionRef;
  evidence: AlertEvidence[];
  /** 0–1. The UI renders it as a percentage from the locale. */
  confidence: number;
  raisedAt: string;
  /** Present only for `slow` signals (D6 FR-20). */
  projection: FailureProjection | null;
  delivery: AlertDelivery[];
  provenance: Provenance;
}

/* ------------------------------------------------------------- maintenance */

export type MaintenanceKind =
  | 'preventiveVisit'
  | 'repair'
  | 'inspection'
  | 'filterService'
  | 'contractRenewal'
  | 'warrantyExpiry';

export type MaintenanceState =
  'completed' | 'inProgress' | 'scheduled' | 'overdue' | 'proposed';

/**
 * D6 FR-33 — maintenance history, contracts, warranty dates and upcoming
 * visits on one timeline. `alertId` is what keeps the timeline out of dead-end
 * territory: a visit traces back to the alert that caused it.
 *
 * @requirement FR-33
 */
export interface MaintenanceEvent {
  id: string;
  kind: MaintenanceKind;
  state: MaintenanceState;
  /** ISO 8601. Past for `completed`, future for `scheduled`. */
  at: string;
  scope: AssetRef;
  titleKey: I18nKey;
  workOrderId: string | null;
  technician: { id: string; name: string } | null;
  alertId: string | null;
  action: ActionRef;
  provenance: Provenance;
}

/* ------------------------------------------------------------- work orders */

/**
 * D2 O-WO — one record, three views: the client tracks it, the technician
 * performs it, HQ dispatches it. There is one object and one set of states,
 * with role variants in the UI; a per-role copy is how the client's "done"
 * comes to disagree with the technician's.
 *
 * The state list is deliberately longer than "open / closed". `closed` is
 * reached by the POST-SERVICE CHECK, never by the technician's own say-so
 * (O-WO.4, "prove the fix, do not assume it"), which is the same rule as
 * Sent → Acknowledged → Verified on a control: a claim is not a settlement.
 */
export type WorkOrderState =
  | 'dispatched'
  | 'accepted'
  | 'inProgress'
  /** Work reported complete; the telemetry has not agreed yet. */
  | 'awaitingVerification'
  | 'closed'
  /** The post-service check found the readings unchanged. */
  | 'reopened'
  | 'escalated';

export type WorkOrderPriority = 'urgent' | 'high' | 'routine';

/** Why this visit exists. A preventive visit and a prediction call-out carry
 *  different briefs, and the technician needs to know which one they are on. */
export type WorkOrderOrigin =
  'prediction' | 'clientRequest' | 'preventiveSchedule' | 'tamper';

export interface WorkOrderAssignee {
  id: string;
  /** A person's name, from data, not from the locale pack. */
  name: string;
  role: Extract<Role, 'technician-internal' | 'technician-thirdparty'>;
}

/**
 * MOCKED in 1A (INV-MOCK-LABEL). A photo is a caption and a time; Phase 1A has
 * no camera and no store, so it does not hand the UI an image URL that would
 * render as a broken picture and read as a missing upload.
 */
export interface EvidencePhoto {
  id: string;
  labelKey: I18nKey;
  takenAt: string;
  mock: true;
}

/** Which side of the limit is the failure. Mirrors `BreachDirection` in the
 *  catalogue; declared here because the wire type does not depend on the
 *  simulator's own tables. */
export type LimitDirection = 'above' | 'below';

/**
 * O-WO Brief — what a technician reads before they travel. The restriction
 * step and the health-sensitive flag are on it because arriving at a stopped
 * unit, or at a nursery, should never be a surprise found on site.
 */
export interface WorkOrderBrief {
  summaryKey: I18nKey;
  origin: WorkOrderOrigin;
  alertId: string | null;
  /** D6 FR-25 — a prediction is SUSPECTED until a technician verdict. Cleared
   *  by a `confirmed` or `notConfirmed` finding, never by the closure. */
  suspected: boolean;
  suspectedPartIds: string[];
  healthSensitive: boolean;
  restrictionStep: RestrictionStep | null;
  accessNoteKey: I18nKey | null;
}

/**
 * O-WO.1 Evidence — "prediction has to show its working before a technician is
 * sent". Signals at trigger time, the groups implicated, the projection for a
 * slow signal, and the data quality behind all of it.
 */
export interface WorkOrderEvidence {
  alertId: string | null;
  raisedAt: string | null;
  signals: AlertEvidence[];
  partGroups: PartGroup[];
  projection: FailureProjection | null;
  /** 0–1, or null when nothing predicted this visit. Never 0 for "unknown". */
  confidence: number | null;
  /** INV-GREY — whether the unit is reporting at all, with when it last did. */
  dataQuality: { reporting: boolean; lastSeen: string | null; noteKey: I18nKey };
  provenance: Provenance;
}

export type ChecklistResult = 'pending' | 'pass' | 'fail' | 'notApplicable';

/**
 * The measurement a checklist step asks for. `observed` is null until somebody
 * takes it — an unrecorded reading is missing, not zero.
 */
export interface ChecklistMeasurement {
  signalKey: I18nKey;
  /** SI symbol, not localised; the label around it is. */
  unit: string;
  limit: Reading;
  breaches: LimitDirection;
  observed: Reading | null;
}

export interface ChecklistItem {
  id: string;
  partId: string;
  group: PartGroup;
  labelKey: I18nKey;
  /** Null for a purely visual step. */
  measurement: ChecklistMeasurement | null;
  result: ChecklistResult;
  photoRequired: boolean;
  photos: EvidencePhoto[];
  noteKey: I18nKey | null;
  recordedAt: string | null;
  recordedBy: string | null;
}

/** O-WO.2 — the checklist is grouped by part group, because that is how the
 *  work is done and how two visits become comparable records. */
export interface WorkOrderChecklistGroup {
  group: PartGroup;
  labelKey: I18nKey;
  items: ChecklistItem[];
  recorded: number;
  failed: number;
  total: number;
}

/** O-WO.3 — "a human decides what the model suspected". */
export type FindingVerdict =
  'confirmed' | 'notConfirmed' | 'sensorFault' | 'dataQualityIssue';

export interface PartUsage {
  sku: string;
  labelKey: I18nKey;
  quantity: number;
}

export interface WorkOrderFinding {
  id: string;
  partId: string | null;
  verdict: FindingVerdict;
  noteKey: I18nKey;
  partsUsed: PartUsage[];
  photos: EvidencePhoto[];
  recordedAt: string;
  recordedBy: string;
  /** D6 FR-25 — disproving a prediction downgrades it. A verdict of
   *  `notConfirmed` or `sensorFault` says the model was wrong, and the alert
   *  stops being presented as a suspected fault. */
  downgradesAlert: boolean;
}

export type WorkOrderOutcome = 'repaired' | 'noFaultFound' | 'escalated';

export interface WorkOrderClosure {
  outcome: WorkOrderOutcome;
  summaryKey: I18nKey;
  closedAt: string;
  closedBy: string;
  escalationReasonKey: I18nKey | null;
  clientConfirmation: {
    state: 'notRequested' | 'requested' | 'confirmed' | 'disputed';
    at: string | null;
  };
  /** Set when there is nothing to re-measure — a property-level preventive
   *  visit has no single signal to check. Stating that is not the same as
   *  quietly claiming the fix was verified. */
  noVerificationReasonKey: I18nKey | null;
}

/** `scheduled` until the window elapses; `inconclusive` when the unit is not
 *  reporting, which is NOT a pass (INV-GREY). */
export type VerificationState = 'scheduled' | 'passed' | 'failed' | 'inconclusive';

/**
 * O-WO.4 — the post-service check. It re-reads the DEVICE signal, not the
 * measurement the technician recorded: the technician's reading is a claim
 * about the moment they were standing there, and the order is settled by what
 * the unit reports afterwards.
 */
export interface PostServiceVerification {
  state: VerificationState;
  partId: string | null;
  signalKey: I18nKey;
  unit: string;
  limit: Reading;
  breaches: LimitDirection;
  /** The reading that justified the visit. */
  before: Reading;
  /** The reading now. Null with a last-seen time when the unit is quiet. */
  after: Reading | null;
  dueAt: string;
  checkedAt: string | null;
  noteKey: I18nKey;
}

export interface WorkOrderTransition {
  at: string;
  from: WorkOrderState | null;
  to: WorkOrderState;
  actorId: string;
  reasonKey: I18nKey | null;
}

/**
 * @requirement FR-32 FR-34
 */
export interface WorkOrder {
  id: string;
  state: WorkOrderState;
  priority: WorkOrderPriority;
  /** Rolled up from the alert that raised it, or the unit. Rendered as colour
   *  + shape + label, never as a bare dot (INV-SEVERITY). */
  severity: Severity;
  kind: MaintenanceKind;
  titleKey: I18nKey;
  scope: AssetRef;
  /** A name a person typed, so it travels as text, not as a key. */
  unitName: string | null;
  assignedTo: WorkOrderAssignee | null;
  openedAt: string;
  slaDueAt: string;
  /** The timeline entry this order belongs to (FR-33), so the client's visit
   *  history and the technician's queue cannot drift apart. */
  maintenanceEventId: string | null;
  brief: WorkOrderBrief;
  evidence: WorkOrderEvidence;
  checklist: WorkOrderChecklistGroup[];
  findings: WorkOrderFinding[];
  closure: WorkOrderClosure | null;
  verification: PostServiceVerification | null;
  history: WorkOrderTransition[];
  action: ActionRef;
  provenance: Provenance;
}

/** What a queue row needs. A list endpoint that returned the whole object
 *  would make the Phase 1B queue pay for twelve checklists per row. */
export interface WorkOrderSummary {
  id: string;
  state: WorkOrderState;
  priority: WorkOrderPriority;
  severity: Severity;
  kind: MaintenanceKind;
  titleKey: I18nKey;
  scope: AssetRef;
  unitName: string | null;
  assignedTo: WorkOrderAssignee | null;
  openedAt: string;
  slaDueAt: string;
  suspected: boolean;
  checklist: { recorded: number; failed: number; total: number };
  verification: VerificationState | null;
  action: ActionRef;
  provenance: Provenance;
}

/**
 * A refusal is data, not an exception. The caller renders `reasonKey`; it
 * never has to invent the sentence that explains why the button did nothing.
 */
export type WorkOrderResult =
  { ok: true; order: WorkOrder } | { ok: false; reasonKey: I18nKey };

export interface ChecklistEntry {
  result: Exclude<ChecklistResult, 'pending'>;
  /** Omitted, the simulator produces the measurement the result implies. */
  observedValue?: number | null;
  photoLabelKeys?: I18nKey[];
  noteKey?: I18nKey | null;
}

export interface FindingEntry {
  partId?: string | null;
  verdict: FindingVerdict;
  noteKey: I18nKey;
  partsUsed?: { sku: string; quantity: number }[];
  photoLabelKeys?: I18nKey[];
}

export interface ClosureEntry {
  outcome: Exclude<WorkOrderOutcome, 'escalated'>;
  summaryKey: I18nKey;
  requestClientConfirmation?: boolean;
}

export interface EscalationEntry {
  reasonKey: I18nKey;
}

/* ------------------------------------------------------------ money, notice */

/**
 * D6 FR-50 SIMULATED in 1A — enough of the account to answer "does money need
 * my attention", which is the only part of billing the Home screen asks.
 */
export interface AccountStanding {
  balanceIdr: Reading;
  dueAt: string;
  state: 'current' | 'dueSoon' | 'overdue';
  /** Present when the restriction ladder is in force anywhere on the account. */
  restriction: UnitRestriction | null;
  payAction: ActionRef;
}

/* ---------------------------------------------------------- client overview */

/**
 * D2 C-1 — one room row: the comfort verdict and the equipment roll-up, kept
 * as two fields on purpose. Merging them would let a warm afternoon and a
 * failing compressor arrive at the reader as the same orange.
 */
export interface RoomComfort {
  roomId: string;
  name: string;
  floorId: string;
  /** A name a person typed. Empty when the floor is system-generated. */
  floorName: string;
  /** Set for system-generated floor names ("Ground Floor"), null otherwise —
   *  the locale pack owns those words, the resident's own words it does not. */
  floorNameKey: I18nKey | null;
  healthSensitive: boolean;
  verdict: ComfortVerdict;
  /** `comfortSeverity(verdict)` — carried so no row recomputes it. */
  comfortSeverity: Severity;
  temperatureC: MaybeReading;
  humidityPct: MaybeReading;
  /** D6 FR-63 — locale keys for the channels this room is not fitted with, so
   *  the row states the absence rather than leaving a gap. */
  absentSensorKeys: I18nKey[];
  /** Equipment status of the units in the room, NOT the comfort verdict. */
  equipment: RollUp;
  href: string;
}

/** D2 C-1 — "an attention banner when payment or a visit needs the client". */
export type AttentionKind =
  'payment' | 'restriction' | 'visit' | 'fault' | 'tamper' | 'dataQuality';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: Severity;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  action: ActionRef;
  dueAt: string | null;
  scope: AssetRef;
}

/**
 * The C-1 read model. It is derived from the same facts every other screen
 * reads — nothing on this screen is authored twice — and it exists as one
 * object because C-1 asks one question ("is anything wrong, and what is this
 * costing me") and one round trip is the API shape Phase 1B will want.
 *
 * @requirement FR-10
 */
export interface ClientOverview {
  generatedAt: string;
  property: { id: string; name: string; category: Category };
  /** D7 §4.2 — worst status of children with the contributing count. */
  rollUp: RollUp;
  /**
   * The dark hero: emissions AVOIDED this month. Never "credit" — Phase 1A has
   * no verified data (INV-CREDIT).
   *
   * The figure is `simulated`, not `estimated`, and the difference matters:
   * the method that produces it is an estimate, but INV-AGGREGATE says an
   * aggregate inherits the WEAKEST of its inputs, and a simulated meter
   * reading is weaker than an estimate. `weakestProvenance(['simulated',
   * 'estimated'])` is `simulated`. In Phase 1B, with real meters, the same
   * fold returns `estimated` without a line of screen code changing.
   */
  hero: {
    avoidedKgCO2e: Reading;
    period: { from: string; to: string };
    gridFactor: GridFactor;
    method: EnergySeries['method'];
    completeness: number;
  };
  kpis: {
    /** Rooms currently inside the comfort envelope. `unknown` rooms are
     *  counted separately and never folded into `comfortable` (INV-GREY). */
    comfort: {
      comfortable: number;
      total: number;
      unknown: number;
      provenance: Provenance;
    };
    /**
     * kWh drawn since local midnight, summed over the units that REPORTED.
     * `reportingUnits` and `totalUnits` travel with it because a total over
     * two thirds of a property is not the property's total, and the reader is
     * entitled to know which they are looking at. A silent unit contributes
     * nothing — not a zero (INV-NO-FABRICATION).
     */
    energyToday: {
      kWh: Reading;
      reportingUnits: number;
      totalUnits: number;
    };
    /** D6 FR-61 — kWh, cost and percentage against the adjusted baseline. */
    savingVsNormal: {
      kWh: Reading;
      pct: Reading;
      idr: Reading;
      /** The figure is not permitted without its method. */
      method: EnergySeries['method'];
      completeness: number;
    };
  };
  rooms: RoomComfort[];
  /** Anything red or orange, plus grey, in roll-up precedence order. */
  alerts: Alert[];
  attention: AttentionItem[];
  maintenance: MaintenanceEvent[];
  /** D2 C-1 energy sparkline — daily kWh with its baseline and method. */
  energy: EnergySeries;
}

/* ---------------------------------------------------------------- control */

/**
 * D6 FR-40 / D7 §13.1 — a command in flight, not a toggle that flipped.
 *
 * The control on the unit does NOT carry `change` until `state` is `verified`;
 * until then this record is the only place the requested position exists. That
 * is the whole point: "we asked" is not "the machine did it".
 */
export interface CommandProgress {
  unitId: string;
  state: CommandState;
  /** From the injected clock, so the record is deterministic. */
  issuedAt: string;
  /** What was asked for. Applied to `Unit['control']` only on `verified`. */
  change: Partial<Unit['control']>;
  /**
   * When the next rung is due, so a UI can schedule one timer instead of
   * polling. `null` for `verified`, `failed` and `queued` — none of them has a
   * next rung, and a countdown to nothing is a lie.
   */
  nextStateAt: string | null;
}

/* ----------------------------------------------------------------- adapter */

/**
 * Who is asking. Typed against `Role` rather than `string` so that a scope
 * cannot be constructed for a role that does not exist, and so that the
 * third-party narrowing in `listProperties` is exhaustive (D6 FR-34).
 */
export interface DataScope {
  role: Role;
  userId: string;
}

export interface Period {
  from: string;
  to: string;
}

/**
 * The seam. Phase 1B replaces the implementation with real ingestion; nothing
 * above this line changes. Async by design even though the Phase 1A
 * implementation is synchronous — a synchronous signature here would force
 * every consuming screen to be rewritten when the network arrives.
 */
export interface TelemetryAdapter {
  /** D6 FR-34 / INV-SCOPE — scoping is applied HERE, not by the screen. A
   *  client sees the properties they own; a third-party technician sees only
   *  the units on their assigned work orders, never the tree around them. */
  listProperties(scope: DataScope): Promise<Property[]>;
  getUnit(scope: DataScope, unitId: string): Promise<Unit | null>;
  /** `assetId` may be a unit, a room, a floor or a property: the series for a
   *  subtree is the sum of its units, and a screen should not have to add
   *  them up itself. */
  getEnergy(scope: DataScope, assetId: string, period: Period): Promise<EnergySeries>;
  getCarbon(scope: DataScope, assetId: string, period: Period): Promise<CarbonSummary>;
  /** D2 C-3 — one attention queue per role. `assetId` may be any level of the
   *  hierarchy; omit it for everything in scope. */
  listAlerts(
    scope: DataScope,
    filter?: { assetId?: string; state?: AlertState; category?: AlertCategory },
  ): Promise<Alert[]>;
  /** D6 FR-33 — history behind, visits ahead, on one timeline. */
  listMaintenance(
    scope: DataScope,
    filter?: { assetId?: string; period?: Period },
  ): Promise<MaintenanceEvent[]>;
  /**
   * D6 FR-34 / INV-SCOPE — a third-party technician is given the work orders
   * assigned to them and no others. The filter narrows what is already in
   * scope; it can never widen it.
   */
  listWorkOrders(
    scope: DataScope,
    filter?: { assetId?: string; state?: WorkOrderState; assignedTo?: string },
  ): Promise<WorkOrderSummary[]>;
  /** `null` rather than a partial object when the caller may not see it: a
   *  redacted work order is still a work order somebody was not given. */
  getWorkOrder(scope: DataScope, workOrderId: string): Promise<WorkOrder | null>;
  /** O-WO.2 — one checklist step, with its measurement and its photos. */
  recordChecklistItem(
    scope: DataScope,
    workOrderId: string,
    itemId: string,
    entry: ChecklistEntry,
  ): Promise<WorkOrderResult>;
  /** O-WO.3 — the technician's verdict on what the model suspected (FR-25). */
  recordFinding(
    scope: DataScope,
    workOrderId: string,
    finding: FindingEntry,
  ): Promise<WorkOrderResult>;
  /**
   * O-WO.4 — reports the work complete. It does NOT close the order: the
   * result is `awaitingVerification` with the post-service check scheduled.
   */
  closeWorkOrder(
    scope: DataScope,
    workOrderId: string,
    closure: ClosureEntry,
  ): Promise<WorkOrderResult>;
  escalateWorkOrder(
    scope: DataScope,
    workOrderId: string,
    escalation: EscalationEntry,
  ): Promise<WorkOrderResult>;
  /** Runs the post-service check now. `passed` closes the order; `failed`
   *  reopens it; `inconclusive` leaves it awaiting, because a unit that is not
   *  reporting has not told us anything (INV-GREY). */
  runPostServiceCheck(scope: DataScope, workOrderId: string): Promise<WorkOrderResult>;
  getAccountStanding(scope: DataScope, propertyId: string): Promise<AccountStanding>;
  /**
   * The C-1 read model. A read model rather than six calls the screen stitches
   * together: the stitching is domain logic (roll-ups, weakest provenance,
   * comfort verdicts) and belongs behind the seam, so Phase 1B replaces one
   * endpoint instead of re-deriving the dashboard in React.
   *
   * `propertyId` selects between the client's properties — the Home/Office
   * switch D2 puts on C-1. Omitted, it resolves to the first property in
   * scope. `null` means "nothing in scope", which the screen renders as the
   * empty state rather than as a dashboard of zeroes.
   */
  getClientOverview(
    scope: DataScope,
    propertyId?: string,
  ): Promise<ClientOverview | null>;
  /**
   * D6 FR-52 / ADR-0015 — the restriction approval queue, admin only.
   *
   * Scoped like every other list on this interface: the caller is given the
   * requests on the properties they can see, and a non-admin is given none.
   * `filter.state` narrows what is already in scope and can never widen it.
   */
  listRestrictionRequests(
    scope: DataScope,
    filter?: { state?: RestrictionRequestState; propertyId?: string },
  ): Promise<RestrictionRequest[]>;
  /** `null` rather than a partial object when the caller may not see it. */
  getRestrictionRequest(
    scope: DataScope,
    requestId: string,
  ): Promise<RestrictionRequest | null>;
  /**
   * D6 FR-53 — approving runs `isStepPermitted()` and REFUSES `stop` on a
   * health-sensitive space, returning `{ ok: false, reasonKey }`.
   *
   * The refusal lives here, behind the seam, because a guarantee a screen can
   * route around is not a guarantee. Approving also requires a named manager
   * on rung 4 (ADR-0015 OD-02) and refuses a rung that skips the one below it.
   */
  decideRestrictionRequest(
    scope: DataScope,
    requestId: string,
    decision: RestrictionDecisionEntry,
  ): Promise<RestrictionRequestResult>;
  /** Returns the lifecycle state; callers render Sent → Acknowledged →
   *  Verified rather than flipping the control (D7 §13.1). */
  sendCommand(
    scope: DataScope,
    unitId: string,
    change: Partial<Unit['control']>,
  ): Promise<CommandProgress>;
  /**
   * Re-reads a command in flight. The state is recomputed from the elapsed
   * time on the INJECTED CLOCK, so a test that moves its own clock sees each
   * rung without sleeping on the wall clock. `null` when nothing has been sent
   * to this unit in this session.
   */
  getCommand(scope: DataScope, unitId: string): Promise<CommandProgress | null>;
  /**
   * Moves a command in flight one rung forward, regardless of the clock.
   *
   * The browser's adapter runs on a FIXED clock (so the dataset's timestamps
   * stay stable for a demo), which means elapsed time alone would never move
   * anything on screen. This is the seam a UI timer drives; a test may drive
   * it too, and gets the same ordered, monotonic progression.
   */
  advanceCommand(scope: DataScope, unitId: string): Promise<CommandProgress | null>;
}
