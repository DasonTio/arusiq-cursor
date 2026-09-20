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

/** Two distinct accounts. ADR-0015 OD-02 makes every approval two-person, so
 *  a context naming one person is no longer a legal approval anywhere here. */
const andi = { id: 'user-ops', name: 'Andi Nugroho' };
const rina = { id: 'user-admin', name: 'Rina Kusuma' };

describe('refuseRestrictionApproval — the gate a screen cannot bypass', () => {
  it('permits the next rung on an ordinary space with two-person control', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'reminder',
        requestedStep: 'setpointRaised',
        space: open,
        signedOffBy: null,
        requester: andi,
        approver: rina,
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
        requester: andi,
        approver: rina,
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
        requester: andi,
        approver: rina,
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
        requester: andi,
        approver: rina,
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
        requester: andi,
        approver: rina,
      }),
    ).toBe('notNextRung');
  });

  it('refuses rung 4 without a named management sign-off, and permits it with one', () => {
    const ctx = {
      currentStep: 'ecoLockLimitedHours',
      requestedStep: 'stop',
      space: open,
      signedOffBy: null,
      requester: andi,
      approver: rina,
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
        requester: andi,
        approver: rina,
      }),
    ).toBeNull();
  });
});

describe('two-person control — ADR-0015 OD-02', () => {
  it('refuses an approver deciding their own request, by id', () => {
    // The hole this closes: nothing stopped one person walking the whole
    // ladder. It held only because the fixture ids happened to differ.
    expect(
      refuseRestrictionApproval({
        currentStep: 'reminder',
        requestedStep: 'setpointRaised',
        space: open,
        signedOffBy: null,
        requester: andi,
        approver: { id: andi.id, name: 'A. Nugroho' },
      }),
    ).toBe('selfApproval');
  });

  it('refuses it by name too, so a second account is not a way round it', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'reminder',
        requestedStep: 'setpointRaised',
        space: open,
        signedOffBy: null,
        requester: andi,
        approver: { id: 'user-other', name: '  andi nugroho ' },
      }),
    ).toBe('selfApproval');
  });

  it('reports self-approval ahead of a missing signature, never instead of it', () => {
    // Same reasoning as the safety refusal: telling a requester they need a
    // signature sends them to fetch one, and the answer is still no.
    expect(
      refuseRestrictionApproval({
        currentStep: 'ecoLockLimitedHours',
        requestedStep: 'stop',
        space: open,
        signedOffBy: null,
        requester: andi,
        approver: andi,
      }),
    ).toBe('selfApproval');
  });

  it('puts the safety refusal ahead of self-approval', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'ecoLockLimitedHours',
        requestedStep: 'stop',
        space: sensitive,
        signedOffBy: null,
        requester: andi,
        approver: andi,
      }),
    ).toBe('healthSensitiveStop');
  });

  it('refuses a rung-4 manager who is the approver or the requester', () => {
    const ctx = {
      currentStep: 'ecoLockLimitedHours',
      requestedStep: 'stop',
      space: open,
      requester: andi,
      approver: rina,
    } as const;
    // Three signatures means three people, or rung 4 is rung 3 with a flourish.
    expect(refuseRestrictionApproval({ ...ctx, signedOffBy: rina.name })).toBe(
      'signOffNotIndependent',
    );
    expect(refuseRestrictionApproval({ ...ctx, signedOffBy: andi.name })).toBe(
      'signOffNotIndependent',
    );
    expect(
      refuseRestrictionApproval({ ...ctx, signedOffBy: 'Sri Handayani' }),
    ).toBeNull();
  });

  it('still permits an ordinary two-person approval on rungs 1–3', () => {
    expect(
      refuseRestrictionApproval({
        currentStep: 'reminder',
        requestedStep: 'setpointRaised',
        space: open,
        signedOffBy: null,
        requester: andi,
        approver: rina,
      }),
    ).toBeNull();
  });
});
