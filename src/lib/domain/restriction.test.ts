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
  worstRung,
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
        currentSteps: ['reminder'],
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
        currentSteps: ['ecoLockLimitedHours'],
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
        currentSteps: ['ecoLockLimitedHours'],
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
        currentSteps: ['reminder'],
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
        currentSteps: ['stop'],
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
      currentSteps: ['ecoLockLimitedHours'],
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
        currentSteps: [null],
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
        currentSteps: ['reminder'],
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
        currentSteps: ['reminder'],
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
        currentSteps: ['ecoLockLimitedHours'],
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
        currentSteps: ['ecoLockLimitedHours'],
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
      currentSteps: ['ecoLockLimitedHours'],
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
        currentSteps: ['reminder'],
        requestedStep: 'setpointRaised',
        space: open,
        signedOffBy: null,
        requester: andi,
        approver: rina,
      }),
    ).toBeNull();
  });
});

describe('the ladder has no skips — D7 §13.2', () => {
  const base = {
    requestedStep: 'setpointRaised',
    space: open,
    signedOffBy: null,
    requester: andi,
    approver: rina,
  } as const;

  it('refuses a space whose units are standing on different rungs', () => {
    // One unit on rung 1, one on nothing. Collapsing to the worst rung and
    // approving rung 2 would carry the second unit past the reminder its
    // occupants were owed — a skip, which is the switch D7 §13.2 forbids.
    expect(
      refuseRestrictionApproval({ ...base, currentSteps: ['reminder', null] }),
    ).toBe('mixedRungs');
  });

  it('permits a space whose units are all on the same rung', () => {
    expect(
      refuseRestrictionApproval({
        ...base,
        currentSteps: ['reminder', 'reminder', 'reminder'],
      }),
    ).toBeNull();
  });

  it('treats a space with no restriction anywhere as one rung, not a mixture', () => {
    expect(
      refuseRestrictionApproval({
        ...base,
        requestedStep: 'reminder',
        currentSteps: [null, null],
      }),
    ).toBeNull();
  });

  it('puts the safety refusal ahead of the mixture', () => {
    expect(
      refuseRestrictionApproval({
        ...base,
        requestedStep: 'stop',
        space: sensitive,
        currentSteps: ['ecoLockLimitedHours', null],
      }),
    ).toBe('healthSensitiveStop');
  });

  it('still reports a genuine skip on a uniform space as notNextRung', () => {
    expect(
      refuseRestrictionApproval({
        ...base,
        requestedStep: 'stop',
        currentSteps: ['reminder', 'reminder'],
      }),
    ).toBe('notNextRung');
  });
});

describe('worstRung — for display, never for a decision', () => {
  it('ranks by ladder position, not by name', () => {
    // Alphabetically 'ecoLockLimitedHours' < 'stop' < 'setpointRaised' is not
    // the ladder order, and a name compare would invert two rungs.
    expect(worstRung(['reminder', 'stop', 'setpointRaised'])).toBe('stop');
    expect(worstRung(['setpointRaised', 'ecoLockLimitedHours'])).toBe(
      'ecoLockLimitedHours',
    );
  });

  it('ignores units with no restriction, and is null when none have one', () => {
    expect(worstRung([null, 'reminder', null])).toBe('reminder');
    expect(worstRung([null, null])).toBeNull();
    expect(worstRung([])).toBeNull();
  });
});
