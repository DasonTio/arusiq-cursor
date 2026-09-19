/**
 * Command lifecycle — where a command sits in the Sent → Acknowledged →
 * Verified pipeline, and which states are terminal holds rather than
 * progression.
 *
 * @requirement FR-40
 */
import { describe, expect, it } from 'vitest';
import {
  advanceCommand,
  commandStage,
  commandStateAfter,
  isPending,
  isSettled,
  nextCommandState,
} from './command.ts';

/** Deliberately not the simulator's own numbers: the ordering is the domain
 *  rule, the durations are policy, and the rule must hold for any of them. */
const timings = { acknowledgedAfterMs: 100, verifiedAfterMs: 500 };

describe('commandStage — pipeline position for the stepper', () => {
  it('marks sent, acknowledged and verified at their own rung', () => {
    expect(commandStage('sent')).toEqual({ reached: 'sent', terminal: null });
    expect(commandStage('acknowledged')).toEqual({
      reached: 'acknowledged',
      terminal: null,
    });
    expect(commandStage('verified')).toEqual({ reached: 'verified', terminal: null });
  });

  it('treats failed as terminal — the stepper shows the break rather than guessing a rung', () => {
    expect(commandStage('failed')).toEqual({ reached: 'sent', terminal: 'failed' });
  });

  it('treats queued as a held command, not a progressed one', () => {
    expect(commandStage('queued')).toEqual({ reached: 'sent', terminal: 'queued' });
  });
});

describe('settled vs pending — "we asked" is not "the machine did it"', () => {
  it('only verified and failed settle', () => {
    expect(isSettled('verified')).toBe(true);
    expect(isSettled('failed')).toBe(true);
    expect(isSettled('sent')).toBe(false);
    expect(isSettled('acknowledged')).toBe(false);
    expect(isSettled('queued')).toBe(false);
  });

  it('queued is pending and shown with its hold time, never swallowed', () => {
    expect(isPending('queued')).toBe(true);
    expect(isPending('sent')).toBe(true);
    expect(isPending('verified')).toBe(false);
  });
});

describe('commandStateAfter — progression as a function of elapsed time', () => {
  it('walks Sent → Acknowledged → Verified and never skips a rung', () => {
    expect(commandStateAfter(0, timings)).toBe('sent');
    expect(commandStateAfter(99, timings)).toBe('sent');
    expect(commandStateAfter(100, timings)).toBe('acknowledged');
    expect(commandStateAfter(499, timings)).toBe('acknowledged');
    expect(commandStateAfter(500, timings)).toBe('verified');
    expect(commandStateAfter(9_000_000, timings)).toBe('verified');
  });

  it('treats a negative elapsed as not yet started rather than as an error', () => {
    expect(commandStateAfter(-1, timings)).toBe('sent');
  });
});

describe('advanceCommand — monotonic, and the honest branches stay put', () => {
  it('moves a sent command forward as simulated time passes', () => {
    expect(advanceCommand('sent', 0, timings)).toBe('sent');
    expect(advanceCommand('sent', 120, timings)).toBe('acknowledged');
    expect(advanceCommand('sent', 600, timings)).toBe('verified');
  });

  it('never walks a command backwards', () => {
    expect(advanceCommand('acknowledged', 0, timings)).toBe('acknowledged');
    expect(advanceCommand('verified', 0, timings)).toBe('verified');
  });

  it('leaves failed broken rather than guessing how far the command got', () => {
    expect(advanceCommand('failed', 9_000_000, timings)).toBe('failed');
  });

  it('leaves queued held — an unreachable device does not acknowledge anything', () => {
    expect(advanceCommand('queued', 9_000_000, timings)).toBe('queued');
  });
});

describe('nextCommandState — the explicit tick a UI or a test can drive', () => {
  it('advances exactly one rung', () => {
    expect(nextCommandState('sent')).toBe('acknowledged');
    expect(nextCommandState('acknowledged')).toBe('verified');
  });

  it('stops at verified', () => {
    expect(nextCommandState('verified')).toBe('verified');
  });

  it('does not rescue a failed or queued command', () => {
    expect(nextCommandState('failed')).toBe('failed');
    expect(nextCommandState('queued')).toBe('queued');
  });
});
