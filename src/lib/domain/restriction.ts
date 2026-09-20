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
  | 'healthSensitiveStop'
  | 'notNextRung'
  | 'selfApproval'
  | 'signOffRequired'
  | 'signOffNotIndependent';

/** Trimmed and case-folded. Two signatures differing only in capitalisation
 *  are one person, and a sign-off box is free text. */
const sameName = (a: string | null, b: string | null): boolean => {
  const left = a?.trim().toLocaleLowerCase() ?? '';
  const right = b?.trim().toLocaleLowerCase() ?? '';
  return left !== '' && left === right;
};

export interface RestrictionApprovalContext {
  /** The rung in force on the affected space now, or `null` for none. */
  currentStep: RestrictionStep | null;
  requestedStep: RestrictionStep;
  space: SpaceRestrictionContext;
  /** The named manager signing rung 4 off. `null` when nobody has. */
  signedOffBy: string | null;
  /**
   * ADR-0015 OD-02 — two-person control. Who raised the request and who is
   * deciding it, so the domain can tell whether that is two people.
   *
   * Ids are the real comparison; the names are here because the rung-4
   * sign-off box is free text and a manager has no id to compare. A name
   * match is weaker evidence than an id match and is treated as a refusal
   * anyway: the cost of blocking a genuine namesake is a second signatory,
   * and the cost of missing it is one person restricting a household alone.
   */
  requester: { id: string; name: string };
  approver: { id: string; name: string };
}

/**
 * `null` when the rung may be approved; otherwise why not.
 *
 * Order matters, and it is the safety order.
 *
 * 1. `healthSensitiveStop` is FIRST so that `stop` on a health-sensitive space
 *    is never reported as a missing signature — that wording invites somebody
 *    to go and find the signature, and no signature makes it permitted
 *    (D6 FR-53).
 * 2. `notNextRung` — whether this rung is approvable at all, before who.
 * 3. `selfApproval` before `signOffRequired`, for the same reason as (1): a
 *    requester approving their own request must not be told they need a
 *    signature, because they would go and get one and the answer would still
 *    be no. Nothing the approver can type fixes being the requester.
 * 4. `signOffNotIndependent` last — it is the narrowest, and it only applies
 *    once a signature exists to examine.
 */
export const refuseRestrictionApproval = (
  ctx: RestrictionApprovalContext,
): RestrictionRefusal | null => {
  if (!isStepPermitted(ctx.requestedStep, ctx.space)) return 'healthSensitiveStop';
  if (ctx.requestedStep !== expectedNextStep(ctx.currentStep)) return 'notNextRung';

  // Two-person control. Restriction is the one action in the product that
  // takes cooling away from a household, and a ladder one person can walk
  // alone is the switch ADR-0015 refused to build.
  if (ctx.requester.id === ctx.approver.id) return 'selfApproval';
  if (sameName(ctx.requester.name, ctx.approver.name)) return 'selfApproval';

  if (!requiresManagementSignOff(ctx.requestedStep)) return null;
  if (!ctx.signedOffBy?.trim()) return 'signOffRequired';

  // Rung 4 is three signatures, which means three people. A manager counter-
  // signing their own approval — or the requester's — restores the two-person
  // rung the third signature exists to exceed.
  if (
    sameName(ctx.signedOffBy, ctx.approver.name) ||
    sameName(ctx.signedOffBy, ctx.requester.name)
  ) {
    return 'signOffNotIndependent';
  }
  return null;
};
