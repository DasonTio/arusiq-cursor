/**
 * Restriction ladder governance — ADR-0015 (OD-01, OD-02).
 *
 * `domain.test.ts` already covers `isStepPermitted`, `nextStep` and
 * `restrictionSeverity`. This file covers what ADR-0015 added on top of them:
 * which rung may be approved, by whom, and the three ways an approval is
 * refused. The refusal is the safety guarantee, so it is tested here — in the
 * layer no screen can route around — and not in the component.
 *
 * @requirement FR-52
 */
import { describe, expect, it } from 'vitest';
import {
  RESTRICTION_STEP,
  expectedNextStep,
  refuseRestrictionApproval,
  requiresManagementSignOff,
} from './restriction.ts';

const open = { healthSensitive: false };
const sensitive = { healthSensitive: true };

describe('expectedNextStep — a ladder is climbed one rung at a time', () => {
  it('starts at the bottom when no restriction is in force', () => {
    expect(expectedNextStep(null)).toBe('reminder');
  });

  it('returns the rung immediately above the one in force', () => {
    expect(expectedNextStep('reminder')).toBe('setpointRaised');
    expect(expectedNextStep('setpointRaised')).toBe('ecoLockLimitedHours');
    expect(expectedNextStep('ecoLockLimitedHours')).toBe('stop');
  });

  it('has nothing above the top rung', () => {
    expect(expectedNextStep('stop')).toBeNull();
  });
});

describe('requiresManagementSignOff — ADR-0015 OD-02', () => {
  it('asks for a named manager only on rung 4', () => {
    expect(requiresManagementSignOff('stop')).toBe(true);
    for (const step of RESTRICTION_STEP.filter((s) => s !== 'stop')) {
      expect(requiresManagementSignOff(step)).toBe(false);
    }
  });
});

describe('refuseRestrictionApproval — the gate a screen cannot bypass', () => {
  it('permits the next rung on an ordinary space with two-person control', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'reminder',
        requestedStep: 'setpointRaised',
        space: open,
        signedOffBy: null,
      }),
    ).toBeNull();
  });

  it('REFUSES stop on a health-sensitive space — D6 FR-53, no signature helps', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'ecoLockLimitedHours',
        requestedStep: 'stop',
        space: sensitive,
        signedOffBy: 'Sri Handayani',
      }),
    ).toBe('healthSensitiveStop');
  });

  it('reports the safety refusal ahead of a missing signature, never instead of it', () => {
    // A `stop` on a nursery is not "needs one more approver". Reporting it as
    // a paperwork problem invites somebody to go and find the paperwork.
    expect(
      refuseRestrictionApproval({
        currentStep: 'ecoLockLimitedHours',
        requestedStep: 'stop',
        space: sensitive,
        signedOffBy: null,
      }),
    ).toBe('healthSensitiveStop');
  });

  it('refuses a rung that skips the one below it', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'reminder',
        requestedStep: 'ecoLockLimitedHours',
        space: open,
        signedOffBy: null,
      }),
    ).toBe('notNextRung');
  });

  it('refuses re-applying the rung already in force', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'stop',
        requestedStep: 'stop',
        space: open,
        signedOffBy: 'Sri Handayani',
      }),
    ).toBe('notNextRung');
  });

  it('refuses rung 4 without a named management sign-off, and permits it with one', () => {
    const ctx = {
      currentStep: 'ecoLockLimitedHours',
      requestedStep: 'stop',
      space: open,
      signedOffBy: null,
    } as const;
    expect(refuseRestrictionApproval(ctx)).toBe('signOffRequired');
    expect(
      refuseRestrictionApproval({ ...ctx, signedOffBy: 'Sri Handayani' }),
    ).toBeNull();
    expect(refuseRestrictionApproval({ ...ctx, signedOffBy: '   ' })).toBe(
      'signOffRequired',
    );
  });

  it('does not ask rungs 1–3 for a manager — ceremony teaches approvers to click through', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: null,
        requestedStep: 'reminder',
        space: sensitive,
        signedOffBy: null,
      }),
    ).toBeNull();
  });
});
