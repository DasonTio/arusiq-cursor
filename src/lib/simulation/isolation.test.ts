/**
 * The seam holds, or Phase 1B is a rewrite.
 *
 * `simulatedTelemetry` stands in for a network. A real adapter hands a screen
 * data that came off the wire, so a screen cannot reach back through a
 * response and change the server. This one hands out objects from a live
 * in-memory store, and where it forgets to copy them a screen can mutate the
 * dataset for every later read — a bug whose symptom appears on a different
 * screen from its cause, which is the worst kind to debug and the easiest
 * kind to ship.
 *
 * So this asserts the property directly, for every read on the interface:
 * mutate everything in a response, read again, and the second answer must be
 * untouched.
 *
 * @requirement FR-10
 */
import { describe, expect, it } from 'vitest';
import { createTelemetryAdapter } from './adapter.ts';
import { fixedClock, REFERENCE_NOW } from './clock.ts';
import { trailingPeriod } from './energy.ts';

const admin = { role: 'admin' as const, userId: 'user-admin' };
const client = { role: 'client' as const, userId: 'user-client' };
const fresh = () => createTelemetryAdapter(fixedClock(REFERENCE_NOW));

/** Scribble over every reachable value, in place. */
function vandalise(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => vandalise(item, seen));
    value.length = 0;
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const current = record[key];
    vandalise(current, seen);
    if (typeof current === 'string') record[key] = 'VANDALISED';
    else if (typeof current === 'number') record[key] = -99999;
    else if (typeof current === 'boolean') record[key] = !current;
    else if (current === null) record[key] = undefined;
  }
}

/** Every read on the adapter, as a named thunk. */
const READS: Record<string, (api: ReturnType<typeof fresh>) => Promise<unknown>> = {
  listProperties: (api) => api.listProperties(admin),
  getUnit: (api) => api.getUnit(admin, 'unit-guest-1'),
  getEnergy: (api) =>
    api.getEnergy(admin, 'prop-bintaro', trailingPeriod(new Date(REFERENCE_NOW), 30)),
  getCarbon: (api) =>
    api.getCarbon(admin, 'prop-bintaro', trailingPeriod(new Date(REFERENCE_NOW), 30)),
  listAlerts: (api) => api.listAlerts(admin),
  listMaintenance: (api) => api.listMaintenance(admin),
  listWorkOrders: (api) => api.listWorkOrders(admin),
  getWorkOrder: async (api) => {
    const [first] = await api.listWorkOrders(admin);
    return api.getWorkOrder(admin, first.id);
  },
  getCommand: async (api) => {
    // Nothing is in flight on a fresh adapter, and `null` would pass this
    // test without exercising anything — so send one first.
    await api.sendCommand(admin, 'unit-guest-1', { mode: 'eco' });
    return api.getCommand(admin, 'unit-guest-1');
  },
  getAccountStanding: (api) => api.getAccountStanding(admin, 'prop-bintaro'),
  getClientOverview: (api) => api.getClientOverview(client),
  listRestrictionRequests: (api) => api.listRestrictionRequests(admin),
  getRestrictionRequest: (api) => api.getRestrictionRequest(admin, 'rq-2026-0031'),
};

describe('the adapter never hands out a live reference to its store', () => {
  it('covers every read on the interface, including ones added later', () => {
    // Without this the suite is a list someone has to remember to extend, and
    // the next `getX` ships uncovered. `list*`/`get*` are the reads; the
    // mutations (record/close/escalate/run/decide/send/advance) are asked to
    // change the store, so they are not in scope here.
    const reads = Object.keys(fresh()).filter((name) => /^(list|get)/.test(name));
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((name) => !(name in READS))).toEqual([]);
  });

  for (const [name, read] of Object.entries(READS)) {
    it(`${name} survives a caller scribbling on its result`, async () => {
      const api = fresh();
      const before = JSON.stringify(await read(api));
      // Sanity: the read has to return something, or this proves nothing.
      expect(before.length).toBeGreaterThan(2);

      vandalise(await read(api));

      const after = JSON.stringify(await read(api));
      expect(after).toBe(before);
    });
  }

  it('does not let one reader empty another reader’s list', async () => {
    // The concrete version of the same bug: `attention` carried references
    // straight out of `dataset.alerts` and `dataset.maintenance`.
    const api = fresh();
    const first = await api.getClientOverview(client);
    expect(first?.attention.length).toBeGreaterThan(0);
    first?.attention.forEach((item) => {
      item.action.href = 'VANDALISED';
      item.scope.propertyId = 'VANDALISED';
    });
    const second = await api.getClientOverview(client);
    second?.attention.forEach((item) => {
      expect(item.action.href).not.toBe('VANDALISED');
      expect(item.scope.propertyId).not.toBe('VANDALISED');
    });
  });
});
