/**
 * Tests for `isNavReachable` — the guard that stops a cross-role sign-in
 * redirect from handing back a path the new role's nav never reaches.
 *
 * @requirement FR-34
 */
import { describe, expect, it } from 'vitest';
import { isNavReachable } from './navigation.ts';

describe('isNavReachable — FR-34', () => {
  it('reaches a role’s own top-level destinations', () => {
    expect(isNavReachable('/home', 'client')).toBe(true);
    expect(isNavReachable('/overview', 'admin')).toBe(true);
    expect(isNavReachable('/work', 'technician-internal')).toBe(true);
  });

  it('does not reach another role’s destinations', () => {
    expect(isNavReachable('/home', 'admin')).toBe(false);
    expect(isNavReachable('/overview', 'client')).toBe(false);
    expect(isNavReachable('/work', 'admin')).toBe(false);
  });

  it('matches a prefix destination by its query-free pathname', () => {
    expect(isNavReachable('/insights', 'client')).toBe(true);
    expect(isNavReachable('/insights/carbon', 'client')).toBe(true);
    expect(isNavReachable('/account/service', 'client')).toBe(true);
  });

  it('reaches an admin sub-item nested under a nav section', () => {
    expect(isNavReachable('/overview/events', 'admin')).toBe(true);
    expect(isNavReachable('/reporting/packages', 'admin')).toBe(true);
  });
});
