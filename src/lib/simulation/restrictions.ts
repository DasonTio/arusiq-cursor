/**
 * The restriction approval queue, and the rule that governs it.
 *
 * ADR-0015 turned three open decisions into data: rung 4 carries a named
 * management sign-off (OD-02), the health-sensitive flag is a request-and-
 * review record rather than a boolean somebody set (OD-01), and the approval
 * *decision* is a thing that exists (which is what `shared.approve` renders).
 *
 * The refusal lives here rather than on the screen. `isStepPermitted()` says
 * `stop` is unreachable for a health-sensitive space, and a guarantee a
 * component could forget to call is not a guarantee — it is a convention. So
 * `decideRequest` runs it, and a screen that never checked still cannot apply
 * rung 4 to a nursery.
 *
 * @requirement FR-52
 */
import {
  RESTRICTION_STEP,
  isStepPermitted,
  refuseRestrictionApproval,
  requiresManagementSignOff,
  type RestrictionRefusal,
  type RestrictionStep,
} from '../domain/restriction.ts';
import { daysAfter, daysBefore, hoursAfter, hoursBefore } from './clock.ts';
import {
  RESTRICTION_REQUEST_SPECS,
  type HealthSensitiveSpec,
  type RestrictionRequestSpec,
} from './fixtures.ts';
import { links } from './links.ts';
import { SIMULATED_POLICY } from './policy.ts';
import type {
  AccountStanding,
  AlertDelivery,
  HealthSensitiveDesignation,
  I18nKey,
  RestrictionDecisionEntry,
  RestrictionRequest,
  RestrictionRequestResult,
  Unit,
  UnitRestriction,
} from './types.ts';

/* ------------------------------------------------------------- reason keys */

/**
 * Every way this module refuses, as locale keys. Mirrors `workOrder.reject.*`
 * so an agent who has read one knows the other; the caller renders the key and
 * never has to invent the sentence that explains why the button did nothing.
 */
export const RESTRICTION_REJECT = {
  /** Out of scope and non-existent give the same answer on purpose: a request
   *  you may not see must not be confirmed to exist by the error you get. */
  notInScope: 'restriction.reject.notInScope',
  alreadyDecided: 'restriction.reject.alreadyDecided',
  /** D6 FR-53 — THE safety refusal. */
  healthSensitiveStop: 'restriction.reject.healthSensitiveStop',
  notNextRung: 'restriction.reject.notNextRung',
  /** ADR-0015 OD-02 — two-person control on every rung. */
  selfApproval: 'restriction.reject.selfApproval',
  signOffRequired: 'restriction.reject.signOffRequired',
  /** Rung 4's third signature has to be a third person. */
  signOffNotIndependent: 'restriction.reject.signOffNotIndependent',
  declineNeedsReason: 'restriction.reject.declineNeedsReason',
} as const satisfies Record<string, I18nKey>;

const REFUSAL_KEY: Record<RestrictionRefusal, I18nKey> = {
  healthSensitiveStop: RESTRICTION_REJECT.healthSensitiveStop,
  notNextRung: RESTRICTION_REJECT.notNextRung,
  selfApproval: RESTRICTION_REJECT.selfApproval,
  signOffRequired: RESTRICTION_REJECT.signOffRequired,
  signOffNotIndependent: RESTRICTION_REJECT.signOffNotIndependent,
};

const reject = (reasonKey: I18nKey): RestrictionRequestResult => ({
  ok: false,
  reasonKey,
});

/* --------------------------------------------------- health-sensitive record */

export const buildHealthSensitiveDesignation = (
  spec: HealthSensitiveSpec,
  now: Date,
): HealthSensitiveDesignation => ({
  requestedBy: {
    id: spec.requesterId,
    name: spec.requesterName,
    role: spec.requesterRole,
  },
  requestedAt: daysBefore(now, spec.requestedDaysAgo),
  evidenceKey: spec.evidenceKey,
  approvedBy: { id: spec.approverId, name: spec.approverName },
  approvedAt: daysBefore(now, spec.approvedDaysAgo),
  reviewBy: daysAfter(now, spec.reviewInDays),
});

/* ------------------------------------------------------------ account roll-up */

/**
 * The rung in force on an ACCOUNT is the worst rung applied to any of its
 * units — "worst" by position on the ladder, never by an alphabetical compare
 * of the step names.
 *
 * Derived rather than authored, and derived HERE rather than twice, so the
 * account banner cannot disagree with the unit banners after an approval has
 * moved one of them.
 */
export const worstRestriction = (
  unitIds: string[],
  unitById: Map<string, Unit>,
): UnitRestriction | null =>
  unitIds
    .map((id) => unitById.get(id)?.restriction)
    .filter((r): r is UnitRestriction => Boolean(r))
    .reduce<UnitRestriction | null>(
      (worst, r) =>
        worst === null ||
        RESTRICTION_STEP.indexOf(r.step) > RESTRICTION_STEP.indexOf(worst.step)
          ? r
          : worst,
      null,
    );

export const refreshAccountRestrictions = (
  accounts: Record<string, AccountStanding>,
  unitIdsByAsset: Map<string, string[]>,
  unitById: Map<string, Unit>,
): void => {
  for (const [propertyId, standing] of Object.entries(accounts)) {
    standing.restriction = worstRestriction(
      unitIdsByAsset.get(propertyId) ?? [],
      unitById,
    );
  }
};

/* ----------------------------------------------------------------- requests */

export interface RestrictionRequestInputs {
  now: Date;
  unitById: Map<string, Unit>;
  /** Every unit id beneath any asset id, at any level of the hierarchy. */
  unitIdsByAsset: Map<string, string[]>;
  /** Free-text names a person typed, by asset id. */
  nameByAssetId: Map<string, string>;
  designationByRoomId: Map<string, HealthSensitiveDesignation>;
  roomIdByUnitId: Map<string, string>;
  /** D6 FR-53 — every unit standing in a designated space. Computed once from
   *  the room flags, so nothing downstream has to walk the tree to find out
   *  whether rung 4 is reachable (ADR-0015 §Consequences). */
  healthSensitiveUnitIds: Set<string>;
  accounts: Record<string, AccountStanding>;
}

/** Which units a request would actually restrict. A request may name a unit, a
 *  room or a whole property; the ladder itself is applied per unit. */
export const affectedUnitIds = (
  request: Pick<RestrictionRequest, 'scope'>,
  unitIdsByAsset: Map<string, string[]>,
): string[] => {
  const { unitId, roomId, propertyId } = request.scope;
  return unitIdsByAsset.get(unitId ?? roomId ?? propertyId) ?? [];
};

/**
 * The rung in force across the affected units — the WORST of them, by position
 * on the ladder rather than by name. A request has to say where it starts or
 * "the next rung" is meaningless.
 */
export const currentStepAcross = (
  unitIds: string[],
  unitById: Map<string, Unit>,
): RestrictionStep | null =>
  unitIds.reduce<RestrictionStep | null>((worst, id) => {
    const step = unitById.get(id)?.restriction?.step;
    if (!step) return worst;
    if (worst === null) return step;
    return RESTRICTION_STEP.indexOf(step) > RESTRICTION_STEP.indexOf(worst)
      ? step
      : worst;
  }, null);

const noticesFor = (spec: RestrictionRequestSpec, now: Date): AlertDelivery[] =>
  spec.notices.map((n) => ({
    channel: n.channel,
    state: n.state,
    at: hoursBefore(now, n.hoursAgo),
  }));

const buildRequest = (
  spec: RestrictionRequestSpec,
  input: RestrictionRequestInputs,
): RestrictionRequest => {
  const { now, unitById, unitIdsByAsset, nameByAssetId, designationByRoomId } = input;
  const scope = {
    propertyId: spec.propertyId,
    ...(spec.roomId ? { roomId: spec.roomId } : {}),
    ...(spec.unitId ? { unitId: spec.unitId } : {}),
  };
  const unitIds = affectedUnitIds({ scope }, unitIdsByAsset);

  // INV-NO-FABRICATION — a designation is read from the rooms the request
  // actually touches. The FIRST one found is carried for display; the flag
  // below is true if ANY of them is designated, because one protected space
  // inside the scope is enough to make rung 4 unreachable for the request.
  const roomIds = [
    ...new Set(
      unitIds.map((id) => input.roomIdByUnitId.get(id)).filter((r): r is string => !!r),
    ),
  ];
  const designation =
    roomIds.map((id) => designationByRoomId.get(id)).find((d) => d !== undefined) ??
    null;
  // One protected space anywhere inside the scope is enough: a request that
  // covers a floor containing a nursery is a request that cannot reach rung 4.
  const healthSensitive = unitIds.some((id) => input.healthSensitiveUnitIds.has(id));

  const currentStep = currentStepAcross(unitIds, unitById);
  const standing = input.accounts[spec.propertyId];
  const dueAt = standing?.dueAt ?? now.toISOString();
  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(dueAt)) / (24 * 60 * 60 * 1000)),
  );

  // `permitted` is the FR-53 safety question and only that: may this rung ever
  // land on this space? It is deliberately NOT the full approval policy, which
  // also weighs the ladder position, two-person control and the rung-4
  // signature — those are answered at decision time, by the person deciding.
  const permitted = isStepPermitted(spec.requestedStep, { healthSensitive });

  return {
    id: spec.id,
    state: spec.decision ? spec.decision.outcome : 'pending',
    scope,
    propertyName: nameByAssetId.get(spec.propertyId) ?? spec.propertyId,
    spaceName:
      nameByAssetId.get(spec.unitId ?? spec.roomId ?? spec.propertyId) ??
      spec.propertyId,
    currentStep,
    requestedStep: spec.requestedStep,
    reasonKey: spec.reasonKey,
    evidenceSummaryKey: spec.evidenceSummaryKey,
    evidence: {
      balanceIdr: standing?.balanceIdr ?? {
        value: null,
        provenance: 'simulated',
        lastSeen: null,
      },
      dueAt,
      daysOverdue,
      notices: noticesFor(spec, now),
    },
    requestedBy: {
      id: spec.requesterId,
      name: spec.requesterName,
      role: spec.requesterRole,
    },
    requestedAt: hoursBefore(now, spec.requestedHoursAgo),
    healthSensitive,
    healthSensitiveDesignation: designation,
    permitted,
    requiresManagementSignOff: requiresManagementSignOff(spec.requestedStep),
    // Stored false; the adapter stamps the truth per reader (`forViewer`),
    // because whether you raised a request is a fact about you, not about it.
    raisedByViewer: false,
    graceHours: SIMULATED_POLICY.restrictionGraceDays[spec.requestedStep] * 24,
    expiresAt: hoursAfter(
      now,
      SIMULATED_POLICY.restrictionRequestExpiryHours - spec.requestedHoursAgo,
    ),
    decision: spec.decision
      ? {
          outcome: spec.decision.outcome,
          decidedBy: spec.decision.decidedBy,
          decidedAt: hoursBefore(now, spec.decision.decidedHoursAgo),
          reasonKey: spec.decision.reasonKey ?? null,
          signedOff: spec.decision.signedOffBy
            ? {
                manager: spec.decision.signedOffBy,
                at: hoursBefore(now, spec.decision.decidedHoursAgo),
              }
            : null,
        }
      : null,
    action: {
      labelKey: 'restriction.request.review',
      href: links.approve(spec.id),
    },
    // Every value in this object came out of the simulator (ADR-0004), and it
    // says so at the source rather than waiting for a screen to add a chip.
    provenance: 'simulated',
  };
};

export const buildRestrictionRequests = (
  input: RestrictionRequestInputs,
): RestrictionRequest[] =>
  RESTRICTION_REQUEST_SPECS.map((spec) => buildRequest(spec, input));

/* ----------------------------------------------------------------- deciding */

export interface DecisionContext {
  now: Date;
  actorName: string;
  /** ADR-0015 OD-02 — the deciding account, so two-person control is checked
   *  against an id and not only against a typed name. */
  actorId: string;
  unitById: Map<string, Unit>;
  unitIdsByAsset: Map<string, string[]>;
  /** The authoritative answer to "is this space protected", re-read at
   *  decision time rather than taken from the request. */
  healthSensitiveUnitIds: Set<string>;
}

/**
 * Apply an approver's decision.
 *
 * The order of the checks is the safety order. A request that is already
 * decided is not re-opened; a decline needs a reason; and an APPROVAL runs
 * `refuseRestrictionApproval()` — which runs `isStepPermitted()` first, so
 * `stop` on a health-sensitive space is refused as a safety matter and never
 * as a missing signature.
 */
export const decideRequest = (
  request: RestrictionRequest,
  entry: RestrictionDecisionEntry,
  ctx: DecisionContext,
): RestrictionRequestResult => {
  if (request.state !== 'pending') return reject(RESTRICTION_REJECT.alreadyDecided);

  const at = ctx.now.toISOString();

  if (entry.outcome === 'decline') {
    if (!entry.reasonKey) return reject(RESTRICTION_REJECT.declineNeedsReason);
    request.state = 'declined';
    request.decision = {
      outcome: 'declined',
      decidedBy: ctx.actorName,
      decidedAt: at,
      reasonKey: entry.reasonKey,
      signedOff: null,
    };
    return { ok: true, request };
  }

  const unitIds = affectedUnitIds(request, ctx.unitIdsByAsset);
  const currentStep = currentStepAcross(unitIds, ctx.unitById);
  const signedOffBy = entry.signedOffBy ?? null;

  const refusal = refuseRestrictionApproval({
    currentStep,
    requestedStep: request.requestedStep,
    // Re-read from the spaces rather than trusting the flag on the request:
    // the request is a message, and a message is not a source of truth about
    // whether a nursery is a nursery.
    space: {
      healthSensitive: unitIds.some((id) => ctx.healthSensitiveUnitIds.has(id)),
    },
    signedOffBy,
    requester: { id: request.requestedBy.id, name: request.requestedBy.name },
    approver: { id: ctx.actorId, name: ctx.actorName },
  });
  if (refusal) return reject(REFUSAL_KEY[refusal]);

  // The ladder moves. Each affected unit gets the rung, its grace period and
  // the two-person record — plus the management sign-off on rung 4.
  for (const id of unitIds) {
    const unit = ctx.unitById.get(id);
    if (!unit) continue;
    const restriction: UnitRestriction = {
      step: request.requestedStep,
      reasonKey: request.reasonKey,
      graceEndsAt: hoursAfter(ctx.now, request.graceHours),
      approval: {
        requester: request.requestedBy.name,
        approver: ctx.actorName,
        at,
        ...(requiresManagementSignOff(request.requestedStep) && signedOffBy
          ? { signedOff: { manager: signedOffBy, at } }
          : {}),
      },
      healthSensitive: ctx.healthSensitiveUnitIds.has(id),
    };
    unit.restriction = restriction;
  }

  request.state = 'approved';
  request.currentStep = request.requestedStep;
  request.decision = {
    outcome: 'approved',
    decidedBy: ctx.actorName,
    decidedAt: at,
    reasonKey: entry.reasonKey ?? null,
    signedOff:
      requiresManagementSignOff(request.requestedStep) && signedOffBy
        ? { manager: signedOffBy, at }
        : null,
  };
  return { ok: true, request };
};
