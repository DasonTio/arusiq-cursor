import { describe, it, expect } from 'vitest';
import { authenticate, LOCKOUT_AFTER, LOCKOUT_MS, type LockState } from './auth.ts';

const start: LockState = { failures: 0, until: null };

describe('authenticate — FR-01 lockout and neutral failure', () => {
  it('signs in a known email with the demo password', () => {
    const result = authenticate('client@arusiq.demo', 'demo', 0, start);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.account.role).toBe('client');
  });

  it('accepts a phone identifier', () => {
    const result = authenticate('08110000004', 'demo', 0, start);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.account.role).toBe('admin');
  });

  it('uses the same invalid result whether the identifier exists or not', () => {
    const missing = authenticate('nobody@arusiq.demo', 'demo', 0, start);
    const wrong = authenticate('client@arusiq.demo', 'nope', 0, start);
    expect(missing).toEqual(wrong);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe('invalid');
  });

  it('locks after five failures for 15 minutes', () => {
    let lock: LockState | null = start;
    let last = authenticate('client@arusiq.demo', 'nope', 1, lock);
    for (let i = 2; i <= LOCKOUT_AFTER; i += 1) {
      if (last.ok) throw new Error('expected failure');
      lock = last.lock;
      last = authenticate('client@arusiq.demo', 'nope', i, lock);
    }
    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.reason).toBe('locked');
      expect(last.lock.until).toBe(5 + LOCKOUT_MS);
    }
  });

  it('refuses even the correct password while locked', () => {
    const locked: LockState = { failures: 5, until: 1000 };
    const result = authenticate('client@arusiq.demo', 'demo', 999, locked);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('locked');
  });

  it('clears the lock after the window and allows a correct password', () => {
    const locked: LockState = { failures: 5, until: 1000 };
    const result = authenticate('client@arusiq.demo', 'demo', 1000, locked);
    expect(result.ok).toBe(true);
  });
});
