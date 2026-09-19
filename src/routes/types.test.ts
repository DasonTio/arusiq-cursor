import { describe, it, expect } from 'vitest';
import { canAccess, type RouteEntry } from './types.ts';
import { landingPath } from './navigation.ts';

const route = (allowedRoles: RouteEntry['allowedRoles']): RouteEntry => ({
  screenId: 'client.overview',
  path: '/home',
  component: () => null,
  allowedRoles,
});

describe('canAccess — INV-SCOPE / FR-34', () => {
  it('lets a client open a client destination', () => {
    expect(canAccess(route(['client']), 'client')).toBe(true);
  });

  it('blocks a client from a technician destination', () => {
    expect(
      canAccess(route(['technician-internal', 'technician-thirdparty']), 'client'),
    ).toBe(false);
  });

  it('lets both technician kinds open assigned work', () => {
    const work = route(['technician-internal', 'technician-thirdparty']);
    expect(canAccess(work, 'technician-internal')).toBe(true);
    expect(canAccess(work, 'technician-thirdparty')).toBe(true);
  });

  it('treats an empty allowedRoles list as nobody, not everybody', () => {
    expect(canAccess(route([]), 'admin')).toBe(false);
    expect(canAccess(route([]), 'client')).toBe(false);
  });
});

describe('landingPath — S-2 role router', () => {
  it('sends each role to its own rail', () => {
    expect(landingPath('client')).toBe('/home');
    expect(landingPath('technician-internal')).toBe('/work');
    expect(landingPath('technician-thirdparty')).toBe('/work');
    expect(landingPath('admin')).toBe('/overview');
  });
});
