/**
 * The fact base. Authored once, read by every screen.
 *
 * ADR-0004 — a dashboard literal is a fixture; a fact the dashboard is derived
 * FROM is an adapter. Nothing on the Home screen is written here as a Home
 * screen number: the hero, the KPI tiles and the room rows are all computed in
 * `overview.ts` from the same units, alerts and meter readings that the space
 * tree, the alert queue and the unit detail read. A figure that disagrees
 * between two screens is therefore not possible.
 *
 * The specs below are deliberately unhappy. ADR-0004: "a prototype where every
 * unit is green demonstrates nothing." Between them these fourteen units cover
 * offline, stale, an absent sensor, a failed command, a queued command, a
 * tamper event, a suspected slow trend, an acute critical fault, planned
 * maintenance suppression, and every rung of the restriction ladder including
 * the health-sensitive space where the last rung is unreachable.
 *
 * @requirement FR-13 FR-15 FR-20 FR-52
 */
import type { CommandState } from '../domain/command.ts';
import type { RestrictionStep } from '../domain/restriction.ts';
import type { Role } from '../domain/role.ts';
import type {
  AlertCategory,
  AlertDelivery,
  Category,
  GridFactor,
  MaintenanceKind,
  MaintenanceState,
  SensorKey,
} from './types.ts';

/* ------------------------------------------------------------------ specs */

/** Faults are authored at the part, never at the unit: part-level health is
 *  the requirement (D6 FR-20) and a unit-level severity is a roll-up of it. */
export interface PartFaultSpec {
  partId: string;
  /** Only `critical` and `warning` are authored. `unknown` is never authored —
   *  it is what the simulator DERIVES when a reading is missing, which is the
   *  whole point of the grey state. */
  severity: 'critical' | 'warning';
  /** D6 FR-25 — a prediction is suspected until a technician verdict. */
  suspected: boolean;
  /** How far past the threshold, as a multiple of the gap between nominal and
   *  threshold. 1.0 sits exactly on the threshold. */
  breach: number;
  sinceDays: number;
  /** 0–1, shown as a percentage. */
  confidence: number;
  /** Slow signals only (D6 FR-20): a projected failure date with a band. */
  projectionDays?: { failureBy: number; earliest: number; latest: number };
}

export interface DeviceSpec {
  offline?: boolean;
  /** Minutes since the last real reading. Past the freshness window this
   *  produces null values with a last-seen time, never a stale number. */
  lastReportMinutesAgo?: number;
  lastHeartbeatMinutesAgo?: number;
  tamperSuspected?: boolean;
  /** D7 §14.5 — planned service suppresses alerts, not severity. */
  maintenanceMode?: boolean;
}

export interface RestrictionSpec {
  step: RestrictionStep;
  reasonKey: string;
  graceHours: number;
  requester: string;
  approver: string;
  decidedHoursAgo: number;
  /** ADR-0015 OD-02 — a named management sign-off, on rung 4 only. Authoring
   *  it on any other rung is a fixture bug, and `buildRestriction` drops it. */
  signedOffBy?: string;
}

export interface UnitSpec {
  id: string;
  name: string;
  brand: string;
  faults?: PartFaultSpec[];
  device?: DeviceSpec;
  /** D6 FR-63 — a channel that is not fitted is STATED AS ABSENT. */
  absentSensors?: SensorKey[];
  mode?: 'cool' | 'fan' | 'eco' | 'off';
  setpointC?: number;
  fanSpeed?: 1 | 2 | 3 | 'auto';
  lastCommand?: { state: CommandState; minutesAgo: number };
  restriction?: RestrictionSpec;
  /** Daily kWh the unit draws when nothing is wrong; the meter series varies
   *  around it deterministically. */
  baseDailyKWh: number;
}

/**
 * ADR-0015 OD-01 — the record behind a health-sensitive flag: who asked, on
 * what evidence, who at HQ approved it, and when it must be looked at again.
 * Authored only for rooms that carry the flag.
 */
export interface HealthSensitiveSpec {
  requesterId: string;
  requesterName: string;
  requesterRole: Role;
  requestedDaysAgo: number;
  evidenceKey: string;
  approverId: string;
  approverName: string;
  approvedDaysAgo: number;
  /** Positive is a future review date. A designation whose review is already
   *  behind it is a real state and the screen should be able to show it. */
  reviewInDays: number;
}

export interface RoomSpec {
  id: string;
  name: string;
  /** D6 FR-53 — blocks the `stop` rung for every unit in the room. */
  healthSensitive?: boolean;
  /** ADR-0015 OD-01 — required whenever `healthSensitive` is true: the flag is
   *  a request-and-review record, not a boolean somebody set. */
  healthSensitiveRecord?: HealthSensitiveSpec;
  units: UnitSpec[];
}

export interface FloorSpec {
  id: string;
  name: string;
  /** System-generated names go through the locale pack; names a person typed
   *  do not (D5 UR-LANG-01, and the `nameKey` field on AssetNode). */
  nameKey?: string;
  rooms: RoomSpec[];
}

export interface PropertySpec {
  id: string;
  name: string;
  category: Category;
  ownerUserId: string;
  /**
   * Where the kWh behind this property comes from. Bintaro is metered per
   * unit (`simulated` in Phase 1A); SCBD is apportioned from one building
   * bill, which is an `estimated` input and drags every aggregate derived
   * from it down with it (INV-AGGREGATE).
   */
  energyBasis: 'metered' | 'apportioned';
  floors: FloorSpec[];
}

/* -------------------------------------------------------------- the people */

/** Ids and names match `DEMO_ACCOUNTS` in `auth.ts`: the person who signs in
 *  is the person on the work order, or FR-34 cannot be demonstrated at all. */
export const TECHNICIANS = [
  { id: 'user-tech', name: 'Budi Pratama', role: 'technician-internal' },
  { id: 'user-partner', name: 'Dewi Lestari', role: 'technician-thirdparty' },
] as const satisfies readonly {
  id: string;
  name: string;
  role: 'technician-internal' | 'technician-thirdparty';
}[];

/* ------------------------------------------------- the client's own property */

const bintaro: PropertySpec = {
  id: 'prop-bintaro',
  name: 'Rumah Bintaro',
  category: 'home',
  ownerUserId: 'user-client',
  energyBasis: 'metered',
  floors: [
    {
      id: 'floor-bintaro-gf',
      name: 'Ground Floor',
      nameKey: 'floor.ground',
      rooms: [
        {
          id: 'room-living',
          name: 'Living Room',
          units: [
            {
              id: 'unit-living-1',
              name: 'Living Room A',
              brand: 'Daikin',
              baseDailyKWh: 6.4,
              setpointC: 24,
              lastCommand: { state: 'verified', minutesAgo: 52 },
            },
            {
              id: 'unit-living-2',
              name: 'Living Room B',
              brand: 'Daikin',
              baseDailyKWh: 6.1,
              setpointC: 24,
              // D6 FR-65 — filter health from pressure drop and run hours,
              // reported as a trend rather than a threshold breach.
              faults: [
                {
                  partId: 'air-filter',
                  severity: 'warning',
                  suspected: true,
                  breach: 1.15,
                  sinceDays: 12,
                  confidence: 0.82,
                  projectionDays: { failureBy: 21, earliest: 11, latest: 38 },
                },
              ],
            },
          ],
        },
        {
          id: 'room-dining',
          name: 'Dining Room',
          units: [
            {
              id: 'unit-dining-1',
              name: 'Dining',
              brand: 'Panasonic',
              baseDailyKWh: 4.8,
              setpointC: 25,
              // The acute critical case: a measurement outside the learned
              // envelope, naming the part it implicates.
              faults: [
                {
                  partId: 'compressor',
                  severity: 'critical',
                  suspected: false,
                  breach: 1.32,
                  sinceDays: 2,
                  confidence: 0.94,
                },
              ],
              lastCommand: { state: 'failed', minutesAgo: 26 },
            },
          ],
        },
        {
          id: 'room-guest',
          name: 'Guest Room',
          units: [
            {
              id: 'unit-guest-1',
              name: 'Guest',
              brand: 'Sharp',
              baseDailyKWh: 3.2,
              setpointC: 25,
              // Online, but the last reading is hours old: grey with a
              // last-seen time, never the last number it happened to send.
              device: { lastReportMinutesAgo: 187, lastHeartbeatMinutesAgo: 4 },
              restriction: {
                step: 'reminder',
                reasonKey: 'restrictionReason.invoiceOverdue',
                graceHours: 72,
                requester: 'Andi Nugroho',
                approver: 'Rina Kusuma',
                decidedHoursAgo: 30,
              },
            },
          ],
        },
        {
          id: 'room-study',
          name: 'Study',
          units: [
            {
              id: 'unit-study-1',
              name: 'Study',
              brand: 'Sharp',
              baseDailyKWh: 2.9,
              setpointC: 24,
              // D7 §14.5 — tamper is critical, and its own category.
              device: { tamperSuspected: true },
              lastCommand: { state: 'acknowledged', minutesAgo: 3 },
            },
          ],
        },
      ],
    },
    {
      id: 'floor-bintaro-1',
      name: 'First Floor',
      nameKey: 'floor.first',
      rooms: [
        {
          id: 'room-master',
          name: 'Master Bedroom',
          units: [
            {
              id: 'unit-master-1',
              name: 'Master',
              brand: 'Daikin',
              baseDailyKWh: 7.3,
              setpointC: 26,
              mode: 'eco',
              // The slow case: a gradual charge decline consistent with a
              // microscopic leak, projected with a band.
              faults: [
                {
                  partId: 'refrigerant-lines',
                  severity: 'warning',
                  suspected: true,
                  breach: 1.08,
                  sinceDays: 34,
                  confidence: 0.71,
                  projectionDays: { failureBy: 58, earliest: 32, latest: 96 },
                },
              ],
              lastCommand: { state: 'sent', minutesAgo: 1 },
              restriction: {
                step: 'setpointRaised',
                reasonKey: 'restrictionReason.invoiceOverdue',
                graceHours: 48,
                requester: 'Andi Nugroho',
                approver: 'Rina Kusuma',
                decidedHoursAgo: 19,
              },
            },
          ],
        },
        {
          id: 'room-nursery',
          name: 'Nursery',
          healthSensitive: true,
          // ADR-0015 OD-01 — the client asked, HQ approved, and it is reviewed.
          // Not a box the account holder ticked: if it were, every account
          // facing restriction would tick it and rung 4 would protect nobody.
          healthSensitiveRecord: {
            requesterId: 'user-client',
            requesterName: 'Sari Wijaya',
            requesterRole: 'client',
            requestedDaysAgo: 96,
            evidenceKey: 'restriction.healthSensitive.evidence.infant',
            approverId: 'user-admin',
            approverName: 'Rina Kusuma',
            approvedDaysAgo: 94,
            reviewInDays: 88,
          },
          units: [
            {
              id: 'unit-nursery-1',
              name: 'Nursery',
              brand: 'Panasonic',
              baseDailyKWh: 5.2,
              setpointC: 25,
              mode: 'eco',
              // Step 3 on a health-sensitive space: the ladder ends here.
              // `isStepPermitted('stop', …)` is false and the banner says so.
              restriction: {
                step: 'ecoLockLimitedHours',
                reasonKey: 'restrictionReason.invoiceOverdue',
                graceHours: 24,
                requester: 'Andi Nugroho',
                approver: 'Rina Kusuma',
                decidedHoursAgo: 8,
              },
            },
          ],
        },
        {
          id: 'room-kids',
          name: "Children's Room",
          units: [
            {
              id: 'unit-kids-1',
              name: 'Kids',
              brand: 'Sharp',
              baseDailyKWh: 4.1,
              setpointC: 25,
              // No air-quality sensors fitted. Stated as absent, not shown as
              // a blank and never as 0 ppm.
              absentSensors: ['co2Ppm', 'pm25'],
              // A technician is on site right now, so the unit has stopped
              // reporting AND its data-quality alert is suppressed (D7 §14.5).
              // The readings still go grey: maintenance mode hides the alert,
              // never the fact that we cannot currently see the unit.
              device: { maintenanceMode: true, lastReportMinutesAgo: 62 },
            },
          ],
        },
        {
          id: 'room-attic',
          name: 'Attic Store',
          units: [
            {
              id: 'unit-attic-1',
              name: 'Attic',
              brand: 'Panasonic',
              baseDailyKWh: 2.2,
              setpointC: 26,
              // Offline since Wednesday: every reading null, every part grey,
              // and the pending command held rather than silently dropped.
              device: { offline: true, lastHeartbeatMinutesAgo: 41 * 60 },
              lastCommand: { state: 'queued', minutesAgo: 35 * 60 },
            },
          ],
        },
      ],
    },
  ],
};

/* ------------------------ a second property, so scoping is provable, not claimed */

const scbd: PropertySpec = {
  id: 'prop-scbd',
  name: 'SCBD Office',
  category: 'office',
  ownerUserId: 'user-client-office',
  energyBasis: 'apportioned',
  floors: [
    {
      id: 'floor-scbd-12',
      name: 'Level 12',
      rooms: [
        {
          id: 'room-scbd-lobby',
          name: 'Lobby',
          units: [
            {
              id: 'unit-scbd-lobby-1',
              name: 'Lobby',
              brand: 'Mitsubishi',
              baseDailyKWh: 9.8,
              setpointC: 26,
              mode: 'off',
              // The fourth rung exists in the dataset, on a space where it is
              // permitted. It is never applied to a health-sensitive room.
              // ADR-0015 OD-02: rung 4 carries a named management sign-off on
              // top of the requester and approver every rung carries.
              restriction: {
                step: 'stop',
                reasonKey: 'restrictionReason.invoiceOverdue',
                graceHours: 12,
                requester: 'Andi Nugroho',
                approver: 'Rina Kusuma',
                decidedHoursAgo: 5,
                signedOffBy: 'Sri Handayani',
              },
            },
          ],
        },
        {
          id: 'room-scbd-open',
          name: 'Open Plan',
          units: [
            {
              id: 'unit-scbd-open-1',
              name: 'Open Plan North',
              brand: 'Mitsubishi',
              baseDailyKWh: 11.4,
              setpointC: 25,
              mode: 'eco',
              // Rung 3 on a space with no health-sensitive designation, so the
              // rung above it is reachable. This is where the one pending
              // request for `stop` sits — the case that is approvable ONLY
              // with a named management sign-off (ADR-0015 OD-02).
              restriction: {
                step: 'ecoLockLimitedHours',
                reasonKey: 'restrictionReason.invoiceOverdue',
                graceHours: 24,
                requester: 'Andi Nugroho',
                approver: 'Rina Kusuma',
                decidedHoursAgo: 14,
              },
            },
            {
              id: 'unit-scbd-open-2',
              name: 'Open Plan South',
              brand: 'Mitsubishi',
              baseDailyKWh: 11.9,
              setpointC: 25,
              faults: [
                {
                  partId: 'condenser-coil',
                  severity: 'warning',
                  suspected: false,
                  breach: 1.11,
                  sinceDays: 21,
                  confidence: 0.77,
                  projectionDays: { failureBy: 44, earliest: 25, latest: 70 },
                },
              ],
            },
          ],
        },
        {
          id: 'room-scbd-meeting',
          name: 'Meeting Room 12A',
          units: [
            {
              id: 'unit-scbd-meeting-1',
              name: 'Meeting 12A',
              brand: 'Daikin',
              baseDailyKWh: 5.6,
              setpointC: 24,
            },
          ],
        },
      ],
    },
    {
      id: 'floor-scbd-13',
      name: 'Level 13',
      rooms: [
        {
          id: 'room-scbd-clinic',
          name: 'Occupational Health Room',
          healthSensitive: true,
          // The second designation, requested by the technician who fitted the
          // room rather than by the account holder — ADR-0015 OD-01 allows
          // both routes in, and its review date has already passed, which is
          // what a designation nobody looked at again looks like.
          healthSensitiveRecord: {
            requesterId: 'user-tech',
            requesterName: 'Budi Pratama',
            requesterRole: 'technician-internal',
            requestedDaysAgo: 412,
            evidenceKey: 'restriction.healthSensitive.evidence.clinicalUse',
            approverId: 'user-admin',
            approverName: 'Rina Kusuma',
            approvedDaysAgo: 408,
            reviewInDays: -43,
          },
          units: [
            {
              id: 'unit-scbd-clinic-1',
              name: 'Health Room',
              brand: 'Daikin',
              baseDailyKWh: 6.0,
              setpointC: 24,
              // Metered on a longer interval than the freshness window: the
              // honest read is grey, not "probably fine".
              device: { lastReportMinutesAgo: 44 },
            },
          ],
        },
      ],
    },
  ],
};

export const PROPERTY_SPECS: readonly PropertySpec[] = [bintaro, scbd];

/* ------------------------------------------------------------------ access */

/**
 * D6 FR-34 / INV-SCOPE — who may see what, as data rather than as a rule a
 * screen is trusted to apply. A third-party technician is listed against
 * individual UNITS, never a property: widening them to the tree around their
 * work order is exactly the failure the requirement names.
 */
export const ACCESS = {
  propertyOwner: {
    'prop-bintaro': 'user-client',
    'prop-scbd': 'user-client-office',
  } as Record<string, string>,
  assignedUnits: {
    'user-tech': ['unit-dining-1', 'unit-living-2', 'unit-attic-1', 'unit-scbd-open-2'],
    'user-partner': ['unit-study-1'],
  } as Record<string, string[]>,
};

/* ------------------------------------------------------- money and factors */

/** D6 FR-101 — versioned tables with effective dates. */
export const TARIFF = {
  id: 'pln-r1-2026',
  idrPerKWh: 1444.7,
  source: 'PLN R-1/TR 2 200 VA',
  effectiveFrom: '2026-01-01',
};

/**
 * D6 FR-70 — "shown, not hidden". A carbon figure without its factor is
 * unauditable, so the factor travels with every carbon number the adapter
 * emits rather than living in a footnote.
 */
export const GRID_FACTOR: GridFactor = {
  value: 0.879,
  unit: 'kgCO2e/kWh',
  source: 'KESDM Jamali grid 2026',
  effectiveFrom: '2026-01-01',
};

/** D6 FR-61 — the method is published, versioned and dated inside the product;
 *  the savings chart is not permitted without a link to it. */
export const BASELINE_METHOD = {
  id: 'adjusted-baseline-v2',
  version: '2.1',
};

/** D6 FR-62 — savings attributed to the lever that produced them, as shares of
 *  the total saving. They sum to 1. */
export const SAVING_LEVERS: readonly { key: string; share: number }[] = [
  { key: 'eco', share: 0.34 },
  { key: 'setpoint', share: 0.27 },
  { key: 'schedule', share: 0.19 },
  { key: 'occupancy', share: 0.12 },
  { key: 'filterCleaning', share: 0.08 },
];

export interface BillingSpec {
  propertyId: string;
  balanceIdr: number;
  dueInDays: number;
  state: 'current' | 'dueSoon' | 'overdue';
}

export const BILLING_SPECS: readonly BillingSpec[] = [
  {
    propertyId: 'prop-bintaro',
    balanceIdr: 1_284_500,
    dueInDays: -6,
    state: 'overdue',
  },
  { propertyId: 'prop-scbd', balanceIdr: 14_920_000, dueInDays: -11, state: 'overdue' },
];

/* --------------------------------------------- the approval queue (FR-52) */

export interface NoticeSpec {
  channel: AlertDelivery['channel'];
  state: AlertDelivery['state'];
  hoursAgo: number;
}

export interface RestrictionDecisionSpec {
  outcome: 'approved' | 'declined';
  decidedBy: string;
  decidedHoursAgo: number;
  reasonKey?: string;
  /** ADR-0015 OD-02 — the named manager, on an approved `stop` only. */
  signedOffBy?: string;
}

/**
 * ADR-0015 — a request to move a named space one rung down the ladder.
 *
 * `admin.restriction-case` used to state, correctly, that "the dataset holds
 * no pending requests", which is why the decision screen could not be built.
 * These are those requests.
 */
export interface RestrictionRequestSpec {
  id: string;
  propertyId: string;
  /** The space the rung would apply to. Omit both for the whole property. */
  roomId?: string;
  unitId?: string;
  requestedStep: RestrictionStep;
  reasonKey: string;
  evidenceSummaryKey: string;
  requesterId: string;
  requesterName: string;
  requesterRole: Role;
  requestedHoursAgo: number;
  /** D6 FR-51 MOCKED — what was sent before the rung was asked for. Notice is
   *  the first half of the ladder's contract; a request with no notice behind
   *  it is visibly one an approver should refuse. */
  notices: NoticeSpec[];
  /** Absent for a request still waiting on a decision. */
  decision?: RestrictionDecisionSpec;
}

/**
 * The queue is deliberately unhappy, like the rest of this file.
 *
 * It holds two requests that are legitimately approvable, one that is
 * approvable ONLY with a named management sign-off, one that MUST be refused
 * because it asks for `stop` on a health-sensitive space, and two already
 * decided so the audit trail is not empty on first load. The refusal is the
 * point of the feature; a queue where everything can be waved through would
 * demonstrate a form, not a safety policy.
 */
export const RESTRICTION_REQUEST_SPECS: readonly RestrictionRequestSpec[] = [
  // 1 · Approvable. Rung 1 is in force, rung 2 is asked for, nothing about the
  // space blocks it, and two notices have been delivered and read.
  {
    id: 'rq-2026-0031',
    propertyId: 'prop-bintaro',
    roomId: 'room-guest',
    unitId: 'unit-guest-1',
    requestedStep: 'setpointRaised',
    reasonKey: 'restrictionReason.invoiceOverdue',
    evidenceSummaryKey: 'restriction.request.evidence.noticesDelivered',
    requesterId: 'user-admin-collections',
    requesterName: 'Andi Nugroho',
    requesterRole: 'admin',
    requestedHoursAgo: 11,
    notices: [
      { channel: 'whatsapp', state: 'read', hoursAgo: 52 },
      { channel: 'email', state: 'delivered', hoursAgo: 28 },
    ],
  },
  // 2 · Approvable. A second pending item so the queue is a queue.
  {
    id: 'rq-2026-0034',
    propertyId: 'prop-bintaro',
    roomId: 'room-master',
    unitId: 'unit-master-1',
    requestedStep: 'ecoLockLimitedHours',
    reasonKey: 'restrictionReason.invoiceOverdue',
    evidenceSummaryKey: 'restriction.request.evidence.graceElapsed',
    requesterId: 'user-admin-collections',
    requesterName: 'Andi Nugroho',
    requesterRole: 'admin',
    requestedHoursAgo: 4,
    notices: [
      { channel: 'whatsapp', state: 'read', hoursAgo: 40 },
      { channel: 'inApp', state: 'read', hoursAgo: 18 },
    ],
  },
  // 3 · MUST BE REFUSED. `stop` on the nursery. `isStepPermitted()` is false
  // and no signature, seniority or overdue balance changes that (D6 FR-53).
  // The request exists because a person can always ASK; the refusal is what
  // the product is for, and it has to be demonstrable.
  {
    id: 'rq-2026-0036',
    propertyId: 'prop-bintaro',
    roomId: 'room-nursery',
    unitId: 'unit-nursery-1',
    requestedStep: 'stop',
    reasonKey: 'restrictionReason.invoiceOverdue',
    evidenceSummaryKey: 'restriction.request.evidence.ladderExhausted',
    requesterId: 'user-admin-collections',
    requesterName: 'Andi Nugroho',
    requesterRole: 'admin',
    requestedHoursAgo: 2,
    notices: [
      { channel: 'whatsapp', state: 'read', hoursAgo: 60 },
      { channel: 'email', state: 'delivered', hoursAgo: 36 },
      { channel: 'inApp', state: 'read', hoursAgo: 9 },
    ],
  },
  // 4 · Approvable, but only with a named manager. Rung 4 on a space with no
  // health-sensitive designation (ADR-0015 OD-02).
  {
    id: 'rq-2026-0029',
    propertyId: 'prop-scbd',
    roomId: 'room-scbd-open',
    unitId: 'unit-scbd-open-1',
    requestedStep: 'stop',
    reasonKey: 'restrictionReason.invoiceOverdue',
    evidenceSummaryKey: 'restriction.request.evidence.ladderExhausted',
    requesterId: 'user-admin-collections',
    requesterName: 'Andi Nugroho',
    requesterRole: 'admin',
    requestedHoursAgo: 7,
    notices: [
      { channel: 'email', state: 'read', hoursAgo: 96 },
      { channel: 'whatsapp', state: 'delivered', hoursAgo: 44 },
    ],
  },
  // 5 · Already approved — the decision record behind the `stop` in force on
  // the SCBD lobby, management sign-off and all.
  {
    id: 'rq-2026-0024',
    propertyId: 'prop-scbd',
    roomId: 'room-scbd-lobby',
    unitId: 'unit-scbd-lobby-1',
    requestedStep: 'stop',
    reasonKey: 'restrictionReason.invoiceOverdue',
    evidenceSummaryKey: 'restriction.request.evidence.ladderExhausted',
    requesterId: 'user-admin-collections',
    requesterName: 'Andi Nugroho',
    requesterRole: 'admin',
    requestedHoursAgo: 9,
    notices: [
      { channel: 'email', state: 'read', hoursAgo: 120 },
      { channel: 'whatsapp', state: 'read', hoursAgo: 72 },
    ],
    decision: {
      outcome: 'approved',
      decidedBy: 'Rina Kusuma',
      decidedHoursAgo: 5,
      signedOffBy: 'Sri Handayani',
    },
  },
  // 6 · Already declined — a refusal that is not the safety one, so the screen
  // has to distinguish "we chose not to" from "we are not allowed to".
  {
    id: 'rq-2026-0019',
    propertyId: 'prop-bintaro',
    roomId: 'room-kids',
    unitId: 'unit-kids-1',
    requestedStep: 'reminder',
    reasonKey: 'restrictionReason.invoiceOverdue',
    evidenceSummaryKey: 'restriction.request.evidence.noticesDelivered',
    requesterId: 'user-admin-collections',
    requesterName: 'Andi Nugroho',
    requesterRole: 'admin',
    requestedHoursAgo: 64,
    notices: [{ channel: 'email', state: 'delivered', hoursAgo: 80 }],
    decision: {
      outcome: 'declined',
      decidedBy: 'Rina Kusuma',
      decidedHoursAgo: 58,
      reasonKey: 'restriction.decline.reason.paymentArranged',
    },
  },
];

/* ------------------------------------------------------------- maintenance */

export interface MaintenanceSpec {
  id: string;
  kind: MaintenanceKind;
  state: MaintenanceState;
  /** Negative is the past, positive is the future. */
  daysFromNow: number;
  propertyId: string;
  roomId?: string;
  unitId?: string;
  workOrderId?: string;
  technicianId?: string;
  /** Traces the visit back to the alert that caused it — this is what keeps
   *  the timeline from being a dead end (INV-NO-DEAD-END). */
  alertId?: string;
}

export const MAINTENANCE_SPECS: readonly MaintenanceSpec[] = [
  {
    id: 'mx-bintaro-01',
    kind: 'preventiveVisit',
    state: 'completed',
    daysFromNow: -96,
    propertyId: 'prop-bintaro',
    workOrderId: 'WO-2026-0418',
    technicianId: 'user-tech',
  },
  {
    id: 'mx-bintaro-02',
    kind: 'filterService',
    state: 'completed',
    daysFromNow: -34,
    propertyId: 'prop-bintaro',
    roomId: 'room-living',
    unitId: 'unit-living-1',
    workOrderId: 'WO-2026-0601',
    technicianId: 'user-tech',
  },
  {
    id: 'mx-bintaro-03',
    kind: 'repair',
    state: 'inProgress',
    daysFromNow: 0,
    propertyId: 'prop-bintaro',
    roomId: 'room-dining',
    unitId: 'unit-dining-1',
    workOrderId: 'WO-2026-0733',
    technicianId: 'user-tech',
    alertId: 'alert-unit-dining-1-compressor',
  },
  {
    id: 'mx-bintaro-04',
    kind: 'inspection',
    state: 'overdue',
    daysFromNow: -4,
    propertyId: 'prop-bintaro',
    roomId: 'room-attic',
    unitId: 'unit-attic-1',
    workOrderId: 'WO-2026-0729',
    technicianId: 'user-tech',
    alertId: 'alert-unit-attic-1-offline',
  },
  {
    id: 'mx-bintaro-05',
    kind: 'filterService',
    state: 'scheduled',
    daysFromNow: 6,
    propertyId: 'prop-bintaro',
    roomId: 'room-living',
    unitId: 'unit-living-2',
    workOrderId: 'WO-2026-0752',
    technicianId: 'user-tech',
    alertId: 'alert-unit-living-2-air-filter',
  },
  {
    id: 'mx-bintaro-06',
    kind: 'preventiveVisit',
    state: 'scheduled',
    daysFromNow: 9,
    propertyId: 'prop-bintaro',
    workOrderId: 'WO-2026-0744',
    technicianId: 'user-tech',
  },
  {
    id: 'mx-bintaro-07',
    kind: 'warrantyExpiry',
    state: 'scheduled',
    daysFromNow: 120,
    propertyId: 'prop-bintaro',
    roomId: 'room-nursery',
    unitId: 'unit-nursery-1',
  },
  {
    id: 'mx-bintaro-08',
    kind: 'contractRenewal',
    state: 'scheduled',
    daysFromNow: 47,
    propertyId: 'prop-bintaro',
  },
  // The slow refrigerant trend on the master unit is the one suspected
  // prediction with no visit attached to it. A proposal is what keeps it from
  // being a dead end (INV-NO-DEAD-END); it has no work order until somebody
  // accepts it, which is exactly what `proposed` means.
  {
    id: 'mx-bintaro-09',
    kind: 'inspection',
    state: 'proposed',
    daysFromNow: 5,
    propertyId: 'prop-bintaro',
    roomId: 'room-master',
    unitId: 'unit-master-1',
    alertId: 'alert-unit-master-1-refrigerant-lines',
  },
  // The third party's only job, on the only unit they can see (FR-34).
  {
    id: 'mx-bintaro-10',
    kind: 'inspection',
    state: 'inProgress',
    daysFromNow: 0,
    propertyId: 'prop-bintaro',
    roomId: 'room-study',
    unitId: 'unit-study-1',
    workOrderId: 'WO-2026-0756',
    technicianId: 'user-partner',
    alertId: 'alert-unit-study-1-tamper',
  },
  // A visit that finished two days ago on a unit that has been quiet since.
  // The work is done and the post-service check still cannot say it worked.
  {
    id: 'mx-bintaro-11',
    kind: 'repair',
    state: 'completed',
    daysFromNow: -2,
    propertyId: 'prop-bintaro',
    roomId: 'room-guest',
    unitId: 'unit-guest-1',
    workOrderId: 'WO-2026-0757',
    technicianId: 'user-tech',
    alertId: 'alert-unit-guest-1-stale',
  },
  {
    id: 'mx-scbd-01',
    kind: 'preventiveVisit',
    state: 'scheduled',
    daysFromNow: 14,
    propertyId: 'prop-scbd',
    workOrderId: 'WO-2026-0751',
    // Internal, not the third party: FR-34 scopes a contractor to the units on
    // their own work orders, so a contractor cannot hold a whole-site visit.
    technicianId: 'user-tech',
  },
  {
    id: 'mx-scbd-02',
    kind: 'repair',
    state: 'inProgress',
    daysFromNow: -1,
    propertyId: 'prop-scbd',
    roomId: 'room-scbd-open',
    unitId: 'unit-scbd-open-2',
    workOrderId: 'WO-2026-0748',
    technicianId: 'user-tech',
    alertId: 'alert-unit-scbd-open-2-condenser-coil',
  },
];

/* ------------------------------------------------------------- work orders */

/**
 * D2 O-WO / D6 FR-32 — how far each order has been taken, NOT what state it
 * ended in. The end state is derived: an order whose closure has been
 * submitted is `closed`, `reopened` or still `awaitingVerification` depending
 * on what the telemetry says afterwards, and authoring that here would let a
 * fixture claim a fix the readings contradict.
 */
export type WorkOrderStage =
  'dispatched' | 'accepted' | 'working' | 'closureSubmitted' | 'escalated';

export interface WorkOrderSpec {
  /** The ids already on the maintenance timeline. One record, three views. */
  id: string;
  stage: WorkOrderStage;
  origin: 'prediction' | 'clientRequest' | 'preventiveSchedule' | 'tamper';
  propertyId: string;
  /** Omitted for a whole-site preventive visit. */
  unitId?: string;
  /** The alert that justified the dispatch — the Evidence view is its working
   *  (O-WO.1), not a second copy of it. */
  alertId?: string;
  assignedTo?: string;
  maintenanceEventId?: string;
  openedDaysAgo: number;
  /** Closure stages only: how long ago the technician reported it complete. */
  closedHoursAgo?: number;
  escalationReasonKey?: string;
  partsUsed?: { sku: string; quantity: number }[];
}

/**
 * Between them these ten orders put every stage a screen must render into the
 * dataset — including the two nobody designs for: a closure the telemetry
 * refused, and a closure the telemetry could not speak to at all.
 */
export const WORK_ORDER_SPECS: readonly WorkOrderSpec[] = [
  {
    id: 'WO-2026-0418',
    stage: 'closureSubmitted',
    origin: 'preventiveSchedule',
    propertyId: 'prop-bintaro',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-01',
    openedDaysAgo: 97,
    closedHoursAgo: 96 * 24,
  },
  {
    id: 'WO-2026-0601',
    stage: 'closureSubmitted',
    origin: 'prediction',
    propertyId: 'prop-bintaro',
    unitId: 'unit-living-1',
    alertId: 'alert-unit-living-1-air-filter',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-02',
    openedDaysAgo: 36,
    closedHoursAgo: 34 * 24,
    partsUsed: [{ sku: 'FLT-A12', quantity: 1 }],
  },
  {
    id: 'WO-2026-0729',
    stage: 'escalated',
    origin: 'prediction',
    propertyId: 'prop-bintaro',
    unitId: 'unit-attic-1',
    alertId: 'alert-unit-attic-1-offline',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-04',
    openedDaysAgo: 5,
    escalationReasonKey: 'workOrder.escalation.unitUnreachable',
  },
  {
    id: 'WO-2026-0733',
    stage: 'working',
    origin: 'prediction',
    propertyId: 'prop-bintaro',
    unitId: 'unit-dining-1',
    alertId: 'alert-unit-dining-1-compressor',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-03',
    openedDaysAgo: 2,
  },
  {
    id: 'WO-2026-0744',
    stage: 'dispatched',
    origin: 'preventiveSchedule',
    propertyId: 'prop-bintaro',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-06',
    openedDaysAgo: 1,
  },
  {
    id: 'WO-2026-0748',
    stage: 'closureSubmitted',
    origin: 'prediction',
    propertyId: 'prop-scbd',
    unitId: 'unit-scbd-open-2',
    alertId: 'alert-unit-scbd-open-2-condenser-coil',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-scbd-02',
    openedDaysAgo: 3,
    closedHoursAgo: 26,
    partsUsed: [{ sku: 'COIL-CLN-05', quantity: 2 }],
  },
  {
    id: 'WO-2026-0751',
    stage: 'dispatched',
    origin: 'preventiveSchedule',
    propertyId: 'prop-scbd',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-scbd-01',
    openedDaysAgo: 1,
  },
  {
    id: 'WO-2026-0752',
    stage: 'accepted',
    origin: 'prediction',
    propertyId: 'prop-bintaro',
    unitId: 'unit-living-2',
    alertId: 'alert-unit-living-2-air-filter',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-05',
    openedDaysAgo: 1,
  },
  {
    id: 'WO-2026-0756',
    stage: 'accepted',
    origin: 'tamper',
    propertyId: 'prop-bintaro',
    unitId: 'unit-study-1',
    alertId: 'alert-unit-study-1-tamper',
    assignedTo: 'user-partner',
    maintenanceEventId: 'mx-bintaro-10',
    openedDaysAgo: 0,
  },
  {
    id: 'WO-2026-0757',
    stage: 'closureSubmitted',
    origin: 'clientRequest',
    propertyId: 'prop-bintaro',
    unitId: 'unit-guest-1',
    alertId: 'alert-unit-guest-1-stale',
    assignedTo: 'user-tech',
    maintenanceEventId: 'mx-bintaro-11',
    openedDaysAgo: 4,
    closedHoursAgo: 46,
    partsUsed: [{ sku: 'SNS-RT-02', quantity: 1 }],
  },
  {
    id: 'WO-2026-0760',
    stage: 'dispatched',
    origin: 'clientRequest',
    propertyId: 'prop-bintaro',
    unitId: 'unit-living-1',
    openedDaysAgo: 0,
  },
];

/* ------------------------------------------------------------- alert wiring */

/**
 * Closed alerts, so the queue has a `resolved` bucket and the maintenance
 * timeline has something to point back at. Authored rather than derived: a
 * resolved alert is a historical fact, not a current condition.
 */
export interface ResolvedAlertSpec {
  id: string;
  unitId: string;
  partId: string;
  severity: 'critical' | 'warning';
  raisedDaysAgo: number;
  confidence: number;
  /** The maintenance event that closed it. */
  closedByEventId: string;
}

export const RESOLVED_ALERT_SPECS: readonly ResolvedAlertSpec[] = [
  {
    id: 'alert-unit-living-1-air-filter',
    unitId: 'unit-living-1',
    partId: 'air-filter',
    severity: 'warning',
    raisedDaysAgo: 48,
    confidence: 0.88,
    closedByEventId: 'mx-bintaro-02',
  },
];

/** How each alert category reaches the reader (D6 FR-22, MOCKED in 1A). */
export const DELIVERY_BY_CATEGORY: Record<
  AlertCategory,
  readonly ('inApp' | 'push' | 'whatsapp' | 'email')[]
> = {
  fault: ['inApp', 'push', 'whatsapp'],
  tamper: ['inApp', 'push', 'whatsapp', 'email'],
  dataQuality: ['inApp'],
  payment: ['inApp', 'whatsapp', 'email'],
};
