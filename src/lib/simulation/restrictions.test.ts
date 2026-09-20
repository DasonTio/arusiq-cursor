/**
 * The restriction approval queue, through the adapter — FR-52, FR-53.
 *
 * The test that matters here is the refusal. `stop` on a health-sensitive
 * space must be impossible to apply THROUGH THE ADAPTER, not merely discouraged
 * by a screen, because Phase 1B swaps the adapter and keeps the screens and a
 * guarantee that lives in a component does not survive that.
 *
 * @requirement FR-52
 */
import { describe, expect, it } from 'vitest';
import { expectedNextStep } from '../domain/restriction.ts';
import { createTelemetryAdapter } from './adapter.ts';
import { fixedClock, REFERENCE_NOW } from './clock.ts';
import { RESTRICTION_REJECT } from './restrictions.ts';

const admin = { role: 'admin' as const, userId: 'user-admin' };
const client = { role: 'client' as const, userId: 'user-client' };
const partner = { role: 'technician-thirdparty' as const, userId: 'user-partner' };

const fresh = () => createTelemetryAdapter(fixedClock(REFERENCE_NOW));

/** The nursery: rung 3 in force, designated health-sensitive, and a pending
 *  request to stop it that must never be grantable. */
const NURSERY_STOP = 'rq-2026-0036';
/** Rung 1 in force, rung 2 asked for, nothing blocking it. */
const GUEST_SETPOINT = 'rq-2026-0031';
/** Rung 4 on a space that permits it — needs a named manager. */
const SCBD_STOP = 'rq-2026-0029';

describe('the queue exists and is scoped to HQ', () => {
  it('holds pending requests, which is what shared.approve was waiting for', async () => {
    const pending = await fresh().listRestrictionRequests(admin, { state: 'pending' });
    expect(pending.length).toBeGreaterThan(1);
    expect(pending.every((r) => r.state === 'pending')).toBe(true);
    expect(pending.every((r) => r.decision === null)).toBe(true);
  });

  it('seeds at least one approvable request and at least one that must be refused', async () => {
    const pending = await fresh().listRestrictionRequests(admin, { state: 'pending' });
    expect(pending.some((r) => r.permitted)).toBe(true);
    expect(pending.some((r) => !r.permitted && r.requestedStep === 'stop')).toBe(true);
  });

  it('carries a decided request as well, so the audit trail is not empty on first load', async () => {
    const all = await fresh().listRestrictionRequests(admin);
    const decided = all.filter((r) => r.decision !== null);
    expect(decided.map((r) => r.state).sort()).toEqual(['approved', 'declined']);
    // ADR-0015 OD-02 — the approved rung 4 names the manager who signed it.
    const approvedStop = decided.find((r) => r.requestedStep === 'stop');
    expect(approvedStop?.decision?.signedOff?.manager).toBeTruthy();
  });

  it('gives a client and a contractor nothing, and answers "no such request"', async () => {
    const adapter = fresh();
    expect(await adapter.listRestrictionRequests(client)).toEqual([]);
    expect(await adapter.listRestrictionRequests(partner)).toEqual([]);
    expect(await adapter.getRestrictionRequest(client, GUEST_SETPOINT)).toBeNull();
    const result = await adapter.decideRestrictionRequest(client, GUEST_SETPOINT, {
      outcome: 'approve',
    });
    expect(result).toEqual({ ok: false, reasonKey: RESTRICTION_REJECT.notInScope });
  });

  it('gives the same answer for a request that does not exist', async () => {
    const result = await fresh().decideRestrictionRequest(admin, 'rq-nope', {
      outcome: 'approve',
    });
    expect(result).toEqual({ ok: false, reasonKey: RESTRICTION_REJECT.notInScope });
  });

  it('stamps provenance at the source on every request', async () => {
    const all = await fresh().listRestrictionRequests(admin);
    expect(all.every((r) => r.provenance === 'simulated')).toBe(true);
    expect(all.every((r) => r.evidence.balanceIdr.provenance === 'simulated')).toBe(
      true,
    );
  });
});

describe('the refusal — D6 FR-53, the whole point of the feature', () => {
  it('REFUSES stop on a health-sensitive space and says why', async () => {
    const adapter = fresh();
    const result = await adapter.decideRestrictionRequest(admin, NURSERY_STOP, {
      outcome: 'approve',
      signedOffBy: 'Sri Handayani',
    });
    expect(result).toEqual({
      ok: false,
      reasonKey: RESTRICTION_REJECT.healthSensitiveStop,
    });
  });

  it('leaves the nursery on the rung it was on — a refused approval changes nothing', async () => {
    const adapter = fresh();
    await adapter.decideRestrictionRequest(admin, NURSERY_STOP, { outcome: 'approve' });
    const nursery = await adapter.getUnit(admin, 'unit-nursery-1');
    expect(nursery?.restriction?.step).toBe('ecoLockLimitedHours');
    const request = await adapter.getRestrictionRequest(admin, NURSERY_STOP);
    expect(request?.state).toBe('pending');
    expect(request?.decision).toBeNull();
  });

  it('marks the request unapprovable before anybody presses anything', async () => {
    const request = await fresh().getRestrictionRequest(admin, NURSERY_STOP);
    expect(request?.healthSensitive).toBe(true);
    expect(request?.permitted).toBe(false);
    // ADR-0015 OD-01 — the flag carries its record, so an approver can see who
    // asked for the designation, on what evidence, and when it is reviewed.
    expect(request?.healthSensitiveDesignation?.requestedBy.name).toBeTruthy();
    expect(request?.healthSensitiveDesignation?.evidenceKey).toMatch(/^restriction\./);
    expect(request?.healthSensitiveDesignation?.reviewBy).toBeTruthy();
  });

  it('can still be DECLINED, so the request is not a dead end', async () => {
    const adapter = fresh();
    const result = await adapter.decideRestrictionRequest(admin, NURSERY_STOP, {
      outcome: 'decline',
      reasonKey: 'restriction.reject.healthSensitiveStop',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.state).toBe('declined');
      expect(result.request.decision?.reasonKey).toBe(
        'restriction.reject.healthSensitiveStop',
      );
    }
  });
});

describe('approving — two-person control, and a manager on rung 4', () => {
  it('moves the ladder exactly one rung and records both people', async () => {
    const adapter = fresh();
    const result = await adapter.decideRestrictionRequest(admin, GUEST_SETPOINT, {
      outcome: 'approve',
    });
    expect(result.ok).toBe(true);

    const unit = await adapter.getUnit(admin, 'unit-guest-1');
    expect(unit?.restriction?.step).toBe('setpointRaised');
    expect(unit?.restriction?.approval.requester).toBeTruthy();
    expect(unit?.restriction?.approval.approver).toBe('user-admin');
    // ADR-0015 OD-02 — rungs 1–3 are two-person control and nothing more.
    expect(unit?.restriction?.approval.signedOff).toBeUndefined();
  });

  it('keeps the account banner in step with the unit banners', async () => {
    const adapter = fresh();
    await adapter.decideRestrictionRequest(admin, GUEST_SETPOINT, {
      outcome: 'approve',
    });
    const standing = await adapter.getAccountStanding(admin, 'prop-bintaro');
    // The worst rung on Bintaro is still the nursery's, which the approval did
    // not touch — the point is that the account is re-derived, not authored.
    expect(standing.restriction?.step).toBe('ecoLockLimitedHours');
  });

  it('refuses rung 4 without a named manager, and grants it with one', async () => {
    const adapter = fresh();
    const refused = await adapter.decideRestrictionRequest(admin, SCBD_STOP, {
      outcome: 'approve',
    });
    expect(refused).toEqual({
      ok: false,
      reasonKey: RESTRICTION_REJECT.signOffRequired,
    });

    const granted = await adapter.decideRestrictionRequest(admin, SCBD_STOP, {
      outcome: 'approve',
      signedOffBy: 'Sri Handayani',
    });
    expect(granted.ok).toBe(true);
    const unit = await adapter.getUnit(admin, 'unit-scbd-open-1');
    expect(unit?.restriction?.step).toBe('stop');
    expect(unit?.restriction?.approval.signedOff?.manager).toBe('Sri Handayani');
  });

  it('will not decide the same request twice', async () => {
    const adapter = fresh();
    await adapter.decideRestrictionRequest(admin, GUEST_SETPOINT, {
      outcome: 'approve',
    });
    const again = await adapter.decideRestrictionRequest(admin, GUEST_SETPOINT, {
      outcome: 'approve',
    });
    expect(again).toEqual({ ok: false, reasonKey: RESTRICTION_REJECT.alreadyDecided });
  });

  it('will not decline without a reason — an audit entry has to explain itself', async () => {
    const result = await fresh().decideRestrictionRequest(admin, GUEST_SETPOINT, {
      outcome: 'decline',
    });
    expect(result).toEqual({
      ok: false,
      reasonKey: RESTRICTION_REJECT.declineNeedsReason,
    });
  });

  it('seeds every pending request at exactly the rung above the one in force', async () => {
    // The `notNextRung` refusal itself is covered in `domain/restriction.test.ts`,
    // where it belongs. What the dataset has to guarantee is that no seeded
    // request is a jump — otherwise the queue teaches an approver that the
    // refusal is noise.
    const pending = await fresh().listRestrictionRequests(admin, { state: 'pending' });
    for (const request of pending) {
      expect(request.requestedStep).toBe(expectedNextStep(request.currentStep));
    }
  });

  it('does not leak a decision into a second adapter instance', async () => {
    const a = fresh();
    await a.decideRestrictionRequest(admin, GUEST_SETPOINT, { outcome: 'approve' });
    const b = fresh();
    const request = await b.getRestrictionRequest(admin, GUEST_SETPOINT);
    expect(request?.state).toBe('pending');
  });
});

describe('the designation record — ADR-0015 OD-01', () => {
  it('sits on the room, beside the boolean rather than instead of it', async () => {
    const properties = await fresh().listProperties(admin);
    const rooms = properties.flatMap((p) => p.floors.flatMap((f) => f.rooms));
    const nursery = rooms.find((r) => r.id === 'room-nursery');
    expect(nursery?.healthSensitive).toBe(true);
    expect(nursery?.healthSensitiveDesignation?.approvedBy.name).toBeTruthy();

    // Every designated room carries a record, and no undesignated room does.
    for (const room of rooms) {
      expect(room.healthSensitiveDesignation !== null).toBe(room.healthSensitive);
    }
  });

  it('carries a review date, including one already behind us', async () => {
    const properties = await fresh().listProperties(admin);
    const rooms = properties.flatMap((p) => p.floors.flatMap((f) => f.rooms));
    const reviews = rooms
      .map((r) => r.healthSensitiveDesignation?.reviewBy)
      .filter((d): d is string => Boolean(d))
      .map((d) => Date.parse(d));
    expect(reviews.some((d) => d < Date.parse(REFERENCE_NOW))).toBe(true);
    expect(reviews.some((d) => d > Date.parse(REFERENCE_NOW))).toBe(true);
  });
});

describe('two-person control at the adapter — ADR-0015 OD-02', () => {
  it('approves for a decider who is not the requester', async () => {
    // The test that did not exist. 387 tests passed while the happy path was
    // broken, because none of them ever approved anything through the adapter.
    const api = fresh();
    const result = await api.decideRestrictionRequest(admin, GUEST_SETPOINT, {
      outcome: 'approve',
      decidedByName: 'Rina Kusuma',
    });
    expect(result.ok).toBe(true);
  });

  it('refuses a decider who raised the request', async () => {
    const api = fresh();
    const collections = { role: 'admin' as const, userId: 'user-admin-collections' };
    const result = await api.decideRestrictionRequest(collections, GUEST_SETPOINT, {
      outcome: 'approve',
      decidedByName: 'Andi Nugroho',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonKey).toBe(RESTRICTION_REJECT.selfApproval);
  });

  it('refuses on the name too, so a second account is not a way round it', async () => {
    const api = fresh();
    const alias = { role: 'admin' as const, userId: 'user-admin-alias' };
    const result = await api.decideRestrictionRequest(alias, GUEST_SETPOINT, {
      outcome: 'approve',
      decidedByName: 'Andi Nugroho',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonKey).toBe(RESTRICTION_REJECT.selfApproval);
  });

  it('tells the reader when they raised the request themselves', async () => {
    const api = fresh();
    const collections = { role: 'admin' as const, userId: 'user-admin-collections' };
    const mine = await api.getRestrictionRequest(collections, GUEST_SETPOINT);
    expect(mine?.raisedByViewer).toBe(true);
    const theirs = await api.getRestrictionRequest(admin, GUEST_SETPOINT);
    expect(theirs?.raisedByViewer).toBe(false);
  });

  it('declining your own request stays allowed — it takes nothing away', async () => {
    const api = fresh();
    const collections = { role: 'admin' as const, userId: 'user-admin-collections' };
    const result = await api.decideRestrictionRequest(collections, GUEST_SETPOINT, {
      outcome: 'decline',
      reasonKey: 'restriction.declineReason.evidenceThin',
      decidedByName: 'Andi Nugroho',
    });
    expect(result.ok).toBe(true);
  });
});
