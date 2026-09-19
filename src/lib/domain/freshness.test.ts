import { describe, it, expect } from 'vitest';
import { freshnessSeverity, isStale } from './freshness.ts';

const now = Date.parse('2026-09-18T02:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

/** An arbitrary window, passed in exactly as a caller must. */
const WINDOW = 10 * 60_000;

describe('isStale — FR-15, the boundary between a value and an unknown', () => {
  it('treats a reading inside the window as fresh', () => {
    expect(isStale(ago(WINDOW - 1), now, WINDOW)).toBe(false);
  });

  it('treats a reading exactly at the window edge as fresh', () => {
    expect(isStale(ago(WINDOW), now, WINDOW)).toBe(false);
  });

  it('treats a reading past the window as stale', () => {
    expect(isStale(ago(WINDOW + 1), now, WINDOW)).toBe(true);
  });

  it('treats a value that has never reported as stale', () => {
    expect(isStale(null, now, WINDOW)).toBe(true);
  });

  it('treats an unparseable timestamp as stale rather than as fresh', () => {
    expect(isStale('not a date', now, WINDOW)).toBe(true);
  });

  it('accepts a Date as well as an epoch', () => {
    expect(isStale(ago(60_000), new Date(now), WINDOW)).toBe(false);
  });

  it('takes the window from its argument rather than a constant of its own', () => {
    const lastSeen = ago(30 * 60_000);
    expect(isStale(lastSeen, now, 15 * 60_000)).toBe(true);
    expect(isStale(lastSeen, now, 60 * 60_000)).toBe(false);
  });
});

describe('freshnessSeverity — INV-GREY, stale is never normal', () => {
  it('keeps the fresh severity when the reading is current', () => {
    expect(freshnessSeverity(ago(60_000), now, WINDOW, 'normal')).toBe('normal');
  });

  it('downgrades a stale reading to unknown, not to normal', () => {
    expect(freshnessSeverity(ago(WINDOW * 4), now, WINDOW, 'normal')).toBe('unknown');
  });

  it('downgrades a stale critical reading to unknown — we no longer know', () => {
    expect(freshnessSeverity(null, now, WINDOW, 'critical')).toBe('unknown');
  });
});
