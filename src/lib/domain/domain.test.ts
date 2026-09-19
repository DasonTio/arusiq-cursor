/**
 * Domain invariants. These four functions are small, and they are where a quiet
 * bug becomes a false claim on a stakeholder's screen — a roll-up that counts a
 * silent sensor as healthy, or a total that reports "verified" because one of
 * its inputs was.
 */
import { describe, it, expect } from 'vitest';
import {
  rollUp,
  countAtOrAbove,
  rollUpWithCount,
  compareSeverity,
  SEVERITY,
  type Severity,
} from './severity.ts';
import { weakestProvenance, mayUseWordCredit, type Provenance } from './provenance.ts';
import {
  isStepPermitted,
  nextStep,
  restrictionSeverity,
  RESTRICTION_STEP,
} from './restriction.ts';
import { isSettled, isPending } from './command.ts';

describe('rollUp — D7 §4.2 precedence: critical > warning > unknown > normal', () => {
  it('takes the worst status of its children', () => {
    expect(rollUp(['normal', 'warning', 'critical'])).toBe('critical');
    expect(rollUp(['normal', 'warning'])).toBe('warning');
  });

  it('lets unknown outrank normal — a silent sensor is not a healthy one', () => {
    // The single most important assertion in this file. Painting an unreported
    // unit green is "a lie the whole product is judged on" (D7 §4.1).
    expect(rollUp(['normal', 'unknown'])).toBe('unknown');
    expect(rollUp(['normal', 'normal', 'unknown', 'normal'])).toBe('unknown');
  });

  it('still lets critical outrank unknown', () => {
    expect(rollUp(['unknown', 'critical'])).toBe('critical');
    expect(rollUp(['unknown', 'warning'])).toBe('warning');
  });

  it('returns normal for no children', () => {
    expect(rollUp([])).toBe('normal');
  });

  it('is order-independent', () => {
    const set: Severity[] = ['normal', 'unknown', 'warning', 'critical'];
    expect(rollUp(set)).toBe(rollUp([...set].reverse()));
  });

  it('ranks every level distinctly', () => {
    const ranks = Object.values(SEVERITY).map((s) => s.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('pairs every level with a shape and a label key, never a bare colour', () => {
    for (const level of Object.values(SEVERITY)) {
      expect(level.shape).toBeTruthy();
      expect(level.labelKey).toMatch(/^severity\./);
    }
  });
});

describe('countAtOrAbove — a roll-up is inspectable, not a bare colour', () => {
  it('counts the children contributing at or above a level', () => {
    const kids: Severity[] = ['normal', 'warning', 'critical', 'normal', 'unknown'];
    expect(countAtOrAbove(kids, 'warning')).toBe(2); // warning + critical
    expect(countAtOrAbove(kids, 'unknown')).toBe(3); // + unknown
    expect(countAtOrAbove(kids, 'critical')).toBe(1);
  });
});

describe('rollUpWithCount — one call, so two neighbours cannot disagree', () => {
  it('counts everything that is not plainly healthy, grey included', () => {
    const kids: Severity[] = ['normal', 'unknown', 'warning', 'normal'];
    expect(rollUpWithCount(kids)).toEqual({
      severity: 'warning',
      contributing: 2,
      total: 4,
    });
  });

  it('reports nothing contributing when every child is normal', () => {
    expect(rollUpWithCount(['normal', 'normal'])).toEqual({
      severity: 'normal',
      contributing: 0,
      total: 2,
    });
  });

  it('reports an empty subtree as normal with a total of zero', () => {
    expect(rollUpWithCount([])).toEqual({
      severity: 'normal',
      contributing: 0,
      total: 0,
    });
  });
});

describe('compareSeverity — attention queues order worst first', () => {
  it('sorts by precedence, not by insertion order', () => {
    const queue: Severity[] = ['normal', 'unknown', 'critical', 'warning'];
    expect([...queue].sort(compareSeverity)).toEqual([
      'critical',
      'warning',
      'unknown',
      'normal',
    ]);
  });

  it('treats equal severities as equal', () => {
    expect(compareSeverity('warning', 'warning')).toBe(0);
  });
});

describe('weakestProvenance — an aggregate inherits the weakest input', () => {
  it('lets one simulated reading make the whole total simulated', () => {
    expect(weakestProvenance(['verified', 'verified', 'simulated'])).toBe('simulated');
  });

  it('does not round up to the majority', () => {
    const many: Provenance[] = Array<Provenance>(20).fill('verified');
    expect(weakestProvenance([...many, 'estimated'])).toBe('estimated');
  });

  it('preserves verified only when every input is verified', () => {
    expect(weakestProvenance(['verified', 'verified'])).toBe('verified');
    expect(weakestProvenance(['verified', 'provisional'])).toBe('provisional');
  });

  it('treats no inputs as verified — the identity for a min-fold', () => {
    expect(weakestProvenance([])).toBe('verified');
  });
});

describe('mayUseWordCredit — D5 UR-CAR-08', () => {
  it('permits "credit" only under verified provenance', () => {
    expect(mayUseWordCredit('verified')).toBe(true);
    for (const p of ['simulated', 'estimated', 'provisional'] as const) {
      expect(mayUseWordCredit(p)).toBe(false);
    }
  });
});

describe('isStepPermitted — D6 FR-53 SAFE CONTROL', () => {
  it('blocks stop for a health-sensitive space', () => {
    expect(isStepPermitted('stop', { healthSensitive: true })).toBe(false);
  });

  it('permits every lesser step for a health-sensitive space', () => {
    for (const step of RESTRICTION_STEP.filter((s) => s !== 'stop')) {
      expect(isStepPermitted(step, { healthSensitive: true })).toBe(true);
    }
  });

  it('permits every step, including stop, for an ordinary space', () => {
    for (const step of RESTRICTION_STEP) {
      expect(isStepPermitted(step, { healthSensitive: false })).toBe(true);
    }
  });
});

describe('restrictionSeverity — a stopped unit is not a reminder', () => {
  it('reports the rung that has actually stopped the cooling as critical', () => {
    expect(restrictionSeverity('stop')).toBe('critical');
  });

  it('reports every rung that still cools as warning', () => {
    for (const step of RESTRICTION_STEP.filter((s) => s !== 'stop')) {
      expect(restrictionSeverity(step)).toBe('warning');
    }
  });

  it('never reports a restriction as normal — silence is how a client finds out from the temperature', () => {
    for (const step of RESTRICTION_STEP) {
      expect(restrictionSeverity(step)).not.toBe('normal');
    }
  });
});

describe('nextStep — the ladder is ordered and terminates', () => {
  it('advances one rung at a time', () => {
    expect(nextStep('reminder')).toBe('setpointRaised');
    expect(nextStep('setpointRaised')).toBe('ecoLockLimitedHours');
    expect(nextStep('ecoLockLimitedHours')).toBe('stop');
  });

  it('stops at stop — there is no fifth step', () => {
    expect(nextStep('stop')).toBeNull();
  });
});

describe('command lifecycle — D7 §13.1', () => {
  it('settles only on verified or failed', () => {
    expect(isSettled('verified')).toBe(true);
    expect(isSettled('failed')).toBe(true);
    expect(isSettled('sent')).toBe(false);
    expect(isSettled('acknowledged')).toBe(false);
  });

  it('treats acknowledged as still pending — the device has not confirmed', () => {
    // "Acknowledged" means the gateway received it, not that the machine did it.
    expect(isPending('acknowledged')).toBe(true);
    expect(isPending('queued')).toBe(true);
    expect(isPending('verified')).toBe(false);
  });
});
