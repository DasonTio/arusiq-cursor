/**
 * A command actually progresses — FR-40.
 *
 * `sendCommand` used to return one static state, so a command a user issued
 * never walked Sent → Acknowledged → Verified and the pipeline on
 * `shared.unit` could only ever show the rung the fixture was authored at.
 *
 * Two seams drive it and they agree, which is the point of the design:
 *
 *   · a MOVING CLOCK — progression is a function of elapsed simulated time, so
 *     a test advances its own clock and asserts each rung without sleeping;
 *   · an EXPLICIT TICK — `advanceCommand()`, for a browser running the fixed
 *     demo clock, where elapsed time alone would never move anything.
 *
 * Neither sleeps on the wall clock, so nothing here is flaky.
 *
 * @requirement FR-40
 */
import { describe, expect, it } from 'vitest';
import { createTelemetryAdapter } from './adapter.ts';
import { fixedClock, REFERENCE_NOW } from './clock.ts';
import { SIMULATED_POLICY } from './policy.ts';
import type { Clock } from './clock.ts';

const admin = { role: 'admin' as const, userId: 'user-admin' };
const partner = { role: 'technician-thirdparty' as const, userId: 'user-partner' };
const { acknowledgedAfterMs, verifiedAfterMs } = SIMULATED_POLICY.commandTimings;

/** A clock a test owns. Deterministic and instantaneous — the whole reason
 *  progression is expressed as elapsed time rather than as a `setTimeout`. */
const movableClock = (start = REFERENCE_NOW) => {
  let at = Date.parse(start);
  const clock: Clock = () => new Date(at);
  return { clock, advance: (ms: number) => (at += ms) };
};

describe('sendCommand — Sent → Acknowledged → Verified on a moving clock', () => {
  it('starts at sent and never claims more than that', async () => {
    const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    const progress = await adapter.sendCommand(admin, 'unit-living-1', {
      setpointC: 22,
    });
    expect(progress.state).toBe('sent');
    expect(progress.unitId).toBe('unit-living-1');
    expect(progress.issuedAt).toBe(REFERENCE_NOW);
    expect(progress.change).toEqual({ setpointC: 22 });
    expect(progress.nextStateAt).toBeTruthy();
  });

  it('walks every rung as simulated time passes, without sleeping', async () => {
    const { clock, advance } = movableClock();
    const adapter = createTelemetryAdapter(clock);
    await adapter.sendCommand(admin, 'unit-living-1', { setpointC: 22 });

    expect((await adapter.getCommand(admin, 'unit-living-1'))?.state).toBe('sent');
    advance(acknowledgedAfterMs);
    expect((await adapter.getCommand(admin, 'unit-living-1'))?.state).toBe(
      'acknowledged',
    );
    advance(verifiedAfterMs - acknowledgedAfterMs);
    expect((await adapter.getCommand(admin, 'unit-living-1'))?.state).toBe('verified');
  });

  it('settles the control ONLY on verified — D7 §13.1', async () => {
    const { clock, advance } = movableClock();
    const adapter = createTelemetryAdapter(clock);
    const before = await adapter.getUnit(admin, 'unit-living-1');
    expect(before?.control.setpointC).toBe(24);

    await adapter.sendCommand(admin, 'unit-living-1', { setpointC: 22, mode: 'eco' });
    advance(acknowledgedAfterMs);
    await adapter.getCommand(admin, 'unit-living-1');
    const acknowledged = await adapter.getUnit(admin, 'unit-living-1');
    // Acknowledged is the device saying "heard you", not "done". The control
    // has NOT moved, which is what stops it rendering as a toggle that flipped.
    expect(acknowledged?.control.setpointC).toBe(24);
    expect(acknowledged?.control.lastCommand?.state).toBe('acknowledged');

    advance(verifiedAfterMs);
    await adapter.getCommand(admin, 'unit-living-1');
    const verified = await adapter.getUnit(admin, 'unit-living-1');
    expect(verified?.control.setpointC).toBe(22);
    expect(verified?.control.mode).toBe('eco');
    expect(verified?.control.lastCommand?.state).toBe('verified');
  });

  it('stops at verified and stays there', async () => {
    const { clock, advance } = movableClock();
    const adapter = createTelemetryAdapter(clock);
    await adapter.sendCommand(admin, 'unit-living-1', { setpointC: 22 });
    advance(verifiedAfterMs * 400);
    expect((await adapter.getCommand(admin, 'unit-living-1'))?.state).toBe('verified');
  });
});

describe('advanceCommand — the explicit tick a browser timer drives', () => {
  it('moves one rung per call on a clock that never moves', async () => {
    const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    await adapter.sendCommand(admin, 'unit-living-1', { setpointC: 22 });
    expect((await adapter.advanceCommand(admin, 'unit-living-1'))?.state).toBe(
      'acknowledged',
    );
    expect((await adapter.advanceCommand(admin, 'unit-living-1'))?.state).toBe(
      'verified',
    );
    expect((await adapter.advanceCommand(admin, 'unit-living-1'))?.state).toBe(
      'verified',
    );
  });

  it('settles the control on the tick that verifies, and not before', async () => {
    const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    await adapter.sendCommand(admin, 'unit-living-1', { fanSpeed: 3 });
    await adapter.advanceCommand(admin, 'unit-living-1');
    expect((await adapter.getUnit(admin, 'unit-living-1'))?.control.fanSpeed).not.toBe(
      3,
    );
    await adapter.advanceCommand(admin, 'unit-living-1');
    expect((await adapter.getUnit(admin, 'unit-living-1'))?.control.fanSpeed).toBe(3);
  });

  it('reports no next rung once there is none', async () => {
    const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    await adapter.sendCommand(admin, 'unit-living-1', { setpointC: 22 });
    await adapter.advanceCommand(admin, 'unit-living-1');
    const verified = await adapter.advanceCommand(admin, 'unit-living-1');
    expect(verified?.nextStateAt).toBeNull();
  });
});

describe('the honest branches stay honest', () => {
  it('HOLDS a command for an offline unit and keeps its time — never silently drops it', async () => {
    const { clock, advance } = movableClock();
    const adapter = createTelemetryAdapter(clock);
    const queued = await adapter.sendCommand(admin, 'unit-attic-1', { setpointC: 22 });
    expect(queued.state).toBe('queued');
    expect(queued.issuedAt).toBe(REFERENCE_NOW);
    expect(queued.nextStateAt).toBeNull();

    advance(verifiedAfterMs * 100);
    expect((await adapter.getCommand(admin, 'unit-attic-1'))?.state).toBe('queued');
    expect((await adapter.advanceCommand(admin, 'unit-attic-1'))?.state).toBe('queued');
    // An unreachable device acknowledged nothing, so the control did not move.
    expect((await adapter.getUnit(admin, 'unit-attic-1'))?.control.setpointC).not.toBe(
      22,
    );
  });

  it('BREAKS the pipeline on a failed unit rather than guessing how far it got', async () => {
    const { clock, advance } = movableClock();
    const adapter = createTelemetryAdapter(clock);
    const failed = await adapter.sendCommand(admin, 'unit-dining-1', { setpointC: 22 });
    expect(failed.state).toBe('failed');
    expect(failed.nextStateAt).toBeNull();

    advance(verifiedAfterMs * 100);
    expect((await adapter.getCommand(admin, 'unit-dining-1'))?.state).toBe('failed');
    expect((await adapter.advanceCommand(admin, 'unit-dining-1'))?.state).toBe(
      'failed',
    );
    expect((await adapter.getUnit(admin, 'unit-dining-1'))?.control.setpointC).not.toBe(
      22,
    );
  });

  it('fails a command to a unit the caller cannot see, without confirming it exists', async () => {
    const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    const result = await adapter.sendCommand(partner, 'unit-living-1', {
      setpointC: 22,
    });
    expect(result.state).toBe('failed');
    // And the unit the partner cannot see is untouched.
    expect((await adapter.getUnit(admin, 'unit-living-1'))?.control.setpointC).toBe(24);
  });

  it('returns null for a unit with nothing in flight', async () => {
    const adapter = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    expect(await adapter.getCommand(admin, 'unit-living-1')).toBeNull();
    expect(await adapter.advanceCommand(admin, 'unit-living-1')).toBeNull();
  });
});

describe('determinism', () => {
  it('gives two adapters on the same clock the same answer at every rung', async () => {
    const a = movableClock();
    const b = movableClock();
    const one = createTelemetryAdapter(a.clock);
    const two = createTelemetryAdapter(b.clock);
    await one.sendCommand(admin, 'unit-living-1', { setpointC: 22 });
    await two.sendCommand(admin, 'unit-living-1', { setpointC: 22 });

    for (const step of [0, acknowledgedAfterMs, verifiedAfterMs]) {
      a.advance(step);
      b.advance(step);
      expect(await one.getCommand(admin, 'unit-living-1')).toEqual(
        await two.getCommand(admin, 'unit-living-1'),
      );
    }
  });

  it('does not leak a command into a second adapter instance', async () => {
    const one = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    await one.sendCommand(admin, 'unit-living-1', { setpointC: 22 });
    await one.advanceCommand(admin, 'unit-living-1');
    await one.advanceCommand(admin, 'unit-living-1');
    const two = createTelemetryAdapter(fixedClock(REFERENCE_NOW));
    expect(await two.getCommand(admin, 'unit-living-1')).toBeNull();
    expect((await two.getUnit(admin, 'unit-living-1'))?.control.setpointC).toBe(24);
  });
});
