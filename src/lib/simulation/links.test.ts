/**
 * Tests for `links.serviceFor` / `links.alertFor` — the role-aware routing
 * that stops a shared object (shared.unit, shared.work-order) from sending a
 * non-client role to a client-only route (FR-34, INV-NO-DEAD-END).
 *
 * @requirement FR-34
 */
import { describe, expect, it } from 'vitest';
import { links } from './links.ts';

describe('links.serviceFor — FR-34', () => {
  it('sends the client to their own service screen', () => {
    expect(links.serviceFor('client')).toBe('/account/service');
  });

  it('sends admin to the service board, not the client-only route', () => {
    expect(links.serviceFor('admin')).toBe('/service');
  });

  it('sends a technician (either scope) to their queue, not the client-only route', () => {
    expect(links.serviceFor('technician-internal')).toBe('/work');
    expect(links.serviceFor('technician-thirdparty')).toBe('/work');
  });
});

describe('links.alertFor — FR-34', () => {
  it('sends the client to the client alert-detail route', () => {
    expect(links.alertFor('client', 'alert-1')).toBe('/alerts?alert=alert-1');
  });

  it('sends admin to the real admin alert-detail route', () => {
    expect(links.alertFor('admin', 'alert-1')).toBe('/overview/events?alert=alert-1');
  });

  it('returns null for a technician — no alert-detail screen exists for that role', () => {
    expect(links.alertFor('technician-internal', 'alert-1')).toBeNull();
    expect(links.alertFor('technician-thirdparty', 'alert-1')).toBeNull();
  });
});
