/**
 * Restriction ladder — the product's most sensitive feature.
 *
 * D6 §10 SAFE CONTROL / D5 UR-PAY-03 — cooling is never cut off. It is stepped
 * down, with notice, grace period and dual approval at every step.
 *
 * D7 §13.2: "If the interface presents step 4 as a single switch, the safety
 * policy is not implemented regardless of what the backend does."
 *
 * @requirement FR-52
 */
import type { Severity } from './severity.ts';

export const RESTRICTION_STEP = [
  'reminder',
  'setpointRaised',
  'ecoLockLimitedHours',
  'stop',
] as const;

export type RestrictionStep = (typeof RESTRICTION_STEP)[number];

export interface SpaceRestrictionContext {
  /** D6 FR-53 — `stop` is never applied to a health-sensitive space. */
  healthSensitive: boolean;
}

export const isStepPermitted = (
  step: RestrictionStep,
  space: SpaceRestrictionContext,
): boolean => !(step === 'stop' && space.healthSensitive);

/** The ladder is ordered; a step may only follow the one before it. */
export const nextStep = (current: RestrictionStep): RestrictionStep | null => {
  const i = RESTRICTION_STEP.indexOf(current);
  return i < RESTRICTION_STEP.length - 1 ? RESTRICTION_STEP[i + 1] : null;
};

/**
 * How loudly a rung asks for attention.
 *
 * `stop` is `critical` because the cooling has actually stopped — that is a
 * consequence the occupant is living with, not a warning about one. The rungs
 * below it still cool, so they are `warning`: unwelcome, and not an emergency.
 * Never `normal`: a restriction the interface renders quietly is a restriction
 * the client discovers from the temperature instead of from the product.
 */
export const restrictionSeverity = (step: RestrictionStep): Severity =>
  step === 'stop' ? 'critical' : 'warning';

/* ------------------------------------------------------------- governance */

/**
 * ADR-0015 OD-02 — two-person control (requester + one independent approver)
 * on rungs 1–3; rung 4 additionally carries a NAMED management sign-off.
 *
 * `stop` is the rung the occupant physically feels and the rung
 * `isStepPermitted()` can refuse outright, so a heavier gate there is
 * proportionate. The same gate on a *reminder* is ceremony, and ceremony is
 * what teaches approvers to click through.
 */
export const requiresManagementSignOff = (step: RestrictionStep): boolean =>
  step === 'stop';

/**
 * The only rung that may be approved next. A ladder that can be jumped is a
 * switch with extra steps drawn on it (D7 §13.2), so "which rung" is decided
 * here rather than by whichever screen built the request.
 *
 * `null` in means nothing is in force yet, so the bottom rung is next.
 * `null` out means there is nothing above the rung already in force.
 */
export const expectedNextStep = (
  current: RestrictionStep | null,
): RestrictionStep | null =>
  current === null ? RESTRICTION_STEP[0] : nextStep(current);

/** Why an approval was refused. An enum rather than a sentence: the domain
 *  does not own words, and the caller maps this to a locale key. */
export type RestrictionRefusal =
  'healthSensitiveStop' | 'notNextRung' | 'signOffRequired';

export interface RestrictionApprovalContext {
  /** The rung in force on the affected space now, or `null` for none. */
  currentStep: RestrictionStep | null;
  requestedStep: RestrictionStep;
  space: SpaceRestrictionContext;
  /** The named manager signing rung 4 off. `null` when nobody has. */
  signedOffBy: string | null;
}

/**
 * `null` when the rung may be approved; otherwise why not.
 *
 * Order matters. The safety refusal is checked FIRST so that `stop` on a
 * health-sensitive space is never reported as a missing signature — that
 * wording invites somebody to go and find the signature, and no signature
 * makes it permitted (D6 FR-53).
 */
export const refuseRestrictionApproval = (
  ctx: RestrictionApprovalContext,
): RestrictionRefusal | null => {
  if (!isStepPermitted(ctx.requestedStep, ctx.space)) return 'healthSensitiveStop';
  if (ctx.requestedStep !== expectedNextStep(ctx.currentStep)) return 'notNextRung';
  if (requiresManagementSignOff(ctx.requestedStep) && !ctx.signedOffBy?.trim()) {
    return 'signOffRequired';
  }
  return null;
};
