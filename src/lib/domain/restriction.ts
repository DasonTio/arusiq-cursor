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
