/**
 * The work-order seam — shared.work-order (O-WO … O-WO.4).
 *
 * Two things are being pinned here, and only one of them is shape. The other
 * is that a claim is not a proof: a technician recording "pass" does not close
 * an order, the telemetry does, and a unit we cannot see is never a pass.
 *
 * @requirement FR-25 FR-32 FR-34
 */
import { describe, expect, it } from 'vitest';
import { createTelemetryAdapter } from './adapter.ts';
import { fixedClock, REFERENCE_NOW } from './clock.ts';
import { walkUnits } from './tree.ts';
import type { ChecklistItem, DataScope, WorkOrder } from './types.ts';

const clock = fixedClock(REFERENCE_NOW);
const adapter = createTelemetryAdapter(clock);
/** Transitions mutate the instance's dataset, so a mutating test gets its own. */
const freshAdapter = () => createTelemetryAdapter(clock);

const client: DataScope = { role: 'client', userId: 'user-client' };
const tech: DataScope = { role: 'technician-internal', userId: 'user-tech' };
const partner: DataScope = { role: 'technician-thirdparty', userId: 'user-partner' };
const admin: DataScope = { role: 'admin', userId: 'user-admin' };

/** The tamper call-out on the study unit: the third party's only assignment,
 *  and the one unit in the dataset with no part fault, so it is also the only
 *  order whose post-service check can honestly pass. */
const TAMPER_WO = 'WO-2026-0756';
/** The compressor repair: acute critical, still breaching. */
const COMPRESSOR_WO = 'WO-2026-0733';

const items = (order: WorkOrder): ChecklistItem[] =>
  order.checklist.flatMap((group) => group.items);

const recordEveryItemAsPass = async (
  a: ReturnType<typeof createTelemetryAdapter>,
  scope: DataScope,
  workOrderId: string,
): Promise<WorkOrder> => {
  const order = await a.getWorkOrder(scope, workOrderId);
  let latest = order!;
  for (const item of items(order!)) {
    const result = await a.recordChecklistItem(scope, workOrderId, item.id, {
      result: 'pass',
    });
    expect(result.ok).toBe(true);
    if (result.ok) latest = result.order;
  }
  return latest;
};

describe('work orders — scope is enforced on the object (FR-34)', () => {
  it('shows a third-party technician their assigned orders and nothing else', async () => {
    const mine = await adapter.listWorkOrders(partner);
    expect(mine.map((o) => o.id)).toEqual([TAMPER_WO]);
    expect(await adapter.getWorkOrder(partner, COMPRESSOR_WO)).toBeNull();
  });

  it('refuses a transition on an order the caller was never given', async () => {
    const a = freshAdapter();
    const order = await a.getWorkOrder(tech, COMPRESSOR_WO);
    const itemId = items(order!)[0].id;
    const rejected = await a.recordChecklistItem(partner, COMPRESSOR_WO, itemId, {
      result: 'pass',
    });
    expect(rejected).toEqual({ ok: false, reasonKey: 'workOrder.reject.notInScope' });
  });

  it('never names a unit the third party cannot otherwise see', async () => {
    const visible = new Set(
      walkUnits(await adapter.listProperties(partner)).map((u) => u.id),
    );
    const assigned = await adapter.listWorkOrders(partner);
    expect(assigned.length).toBeGreaterThan(0);
    for (const order of assigned) {
      if (order.scope.unitId) expect(visible.has(order.scope.unitId)).toBe(true);
    }
    // And the converse: a unit in scope is in scope BECAUSE of an order.
    for (const unitId of visible) {
      expect(assigned.some((o) => o.scope.unitId === unitId)).toBe(true);
    }
  });

  it('gives the client their own property, the admin everything', async () => {
    const theirs = await adapter.listWorkOrders(client);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((o) => o.scope.propertyId === 'prop-bintaro')).toBe(true);
    const all = await adapter.listWorkOrders(admin);
    expect(all.length).toBeGreaterThan(theirs.length);
    expect(all.some((o) => o.scope.propertyId === 'prop-scbd')).toBe(true);
  });

  it('filters by asset and by state without widening scope', async () => {
    const onDining = await adapter.listWorkOrders(admin, { assetId: 'unit-dining-1' });
    expect(onDining.map((o) => o.id)).toEqual([COMPRESSOR_WO]);
    const reopened = await adapter.listWorkOrders(admin, { state: 'reopened' });
    expect(reopened.length).toBeGreaterThan(0);
    expect(reopened.every((o) => o.state === 'reopened')).toBe(true);
    expect(await adapter.listWorkOrders(partner, { assetId: 'unit-dining-1' })).toEqual(
      [],
    );
  });
});

describe('work orders — brief, evidence and checklist (FR-25 FR-32)', () => {
  it('carries the prediction evidence that justified the dispatch', async () => {
    const order = (await adapter.getWorkOrder(tech, COMPRESSOR_WO))!;
    expect(order.brief.alertId).toBe('alert-unit-dining-1-compressor');
    expect(order.evidence.signals.length).toBeGreaterThan(0);
    for (const signal of order.evidence.signals) {
      expect(signal.observed.provenance).toBe('simulated');
      expect(signal.threshold.value).not.toBeNull();
    }
    expect(order.evidence.partGroups).toContain('outdoor');
    expect(order.evidence.confidence).toBeGreaterThan(0);
    expect(order.evidence.dataQuality.reporting).toBe(true);
  });

  it('keeps a prediction SUSPECTED until a technician verdict, and downgrades it on one', async () => {
    const a = freshAdapter();
    const filter = (await a.getWorkOrder(tech, 'WO-2026-0752'))!;
    expect(filter.brief.suspected).toBe(true);
    const verdict = await a.recordFinding(tech, 'WO-2026-0752', {
      partId: 'air-filter',
      verdict: 'notConfirmed',
      noteKey: 'workOrder.finding.notConfirmed.note',
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.order.findings.at(-1)?.downgradesAlert).toBe(true);
      expect(verdict.order.brief.suspected).toBe(false);
    }
  });

  it('states the data quality rather than implying a live unit', async () => {
    const attic = (await adapter.getWorkOrder(tech, 'WO-2026-0729'))!;
    expect(attic.evidence.dataQuality.reporting).toBe(false);
    expect(attic.evidence.dataQuality.lastSeen).toBeTruthy();
    expect(attic.evidence.confidence).not.toBeNull();
  });

  it('groups the checklist indoor · outdoor · electrical over the twelve parts', async () => {
    const order = (await adapter.getWorkOrder(tech, COMPRESSOR_WO))!;
    expect(order.checklist.map((g) => g.group)).toEqual([
      'indoor',
      'outdoor',
      'electrical',
    ]);
    expect(items(order)).toHaveLength(12);
    for (const group of order.checklist) {
      expect(group.labelKey).toBe(`partGroup.${group.group}`);
      expect(group.total).toBe(group.items.length);
    }
  });

  it('asks for a measurement against a limit, and leaves it null until it is taken', async () => {
    const order = (await adapter.getWorkOrder(tech, COMPRESSOR_WO))!;
    for (const item of items(order)) {
      expect(item.labelKey).toBe(`part.${item.partId}`);
      const measurement = item.measurement!;
      expect(measurement.unit).toBeTruthy();
      expect(measurement.limit.provenance).toBe('simulated');
      if (item.result === 'pending') {
        // Missing is not zero: an unrecorded measurement is absent, not 0.
        expect(measurement.observed).toBeNull();
        expect(item.recordedAt).toBeNull();
      }
    }
  });

  it('labels a photo as a mock rather than promising an image', async () => {
    const order = (await adapter.getWorkOrder(tech, COMPRESSOR_WO))!;
    const photos = items(order).flatMap((i) => i.photos);
    expect(photos.length).toBeGreaterThan(0);
    for (const photo of photos) {
      expect(photo.mock).toBe(true);
      expect(photo.labelKey).toMatch(/^workOrder\.photo\./);
      expect(photo.takenAt).toBeTruthy();
    }
  });

  it('records a measurement stamped simulated at the source', async () => {
    const a = freshAdapter();
    const order = (await a.getWorkOrder(tech, COMPRESSOR_WO))!;
    const pending = items(order).find((i) => i.result === 'pending')!;
    const result = await a.recordChecklistItem(tech, COMPRESSOR_WO, pending.id, {
      result: 'pass',
      photoLabelKeys: ['workOrder.photo.afterService'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recorded = items(result.order).find((i) => i.id === pending.id)!;
    expect(recorded.result).toBe('pass');
    expect(recorded.measurement?.observed?.provenance).toBe('simulated');
    expect(recorded.measurement?.observed?.value).not.toBeNull();
    expect(recorded.recordedAt).toBe(REFERENCE_NOW);
    expect(
      recorded.photos.some((p) => p.labelKey === 'workOrder.photo.afterService'),
    ).toBe(true);
    expect(result.order.state).toBe('inProgress');
  });
});

describe('work orders — closure, escalation and the post-service check (FR-32)', () => {
  it('will not close an order whose checklist is unfinished', async () => {
    const a = freshAdapter();
    const rejected = await a.closeWorkOrder(tech, COMPRESSOR_WO, {
      outcome: 'repaired',
      summaryKey: 'workOrder.closure.repaired.summary',
    });
    expect(rejected).toEqual({
      ok: false,
      reasonKey: 'workOrder.reject.checklistIncomplete',
    });
  });

  it('will not close over a failing measurement — that is what escalation is for', async () => {
    const a = freshAdapter();
    const order = (await a.getWorkOrder(tech, COMPRESSOR_WO))!;
    expect(items(order).some((i) => i.result === 'fail')).toBe(true);
    for (const item of items(order).filter((i) => i.result === 'pending')) {
      await a.recordChecklistItem(tech, COMPRESSOR_WO, item.id, { result: 'pass' });
    }
    const rejected = await a.closeWorkOrder(tech, COMPRESSOR_WO, {
      outcome: 'repaired',
      summaryKey: 'workOrder.closure.repaired.summary',
    });
    expect(rejected).toEqual({ ok: false, reasonKey: 'workOrder.reject.itemFailed' });
  });

  it('will not close without a human verdict on what the model suspected', async () => {
    const a = freshAdapter();
    await recordEveryItemAsPass(a, partner, TAMPER_WO);
    const rejected = await a.closeWorkOrder(partner, TAMPER_WO, {
      outcome: 'repaired',
      summaryKey: 'workOrder.closure.repaired.summary',
    });
    expect(rejected).toEqual({
      ok: false,
      reasonKey: 'workOrder.reject.findingRequired',
    });
  });

  it('settles a closure only after the telemetry agrees', async () => {
    const a = freshAdapter();
    await recordEveryItemAsPass(a, partner, TAMPER_WO);
    await a.recordFinding(partner, TAMPER_WO, {
      verdict: 'confirmed',
      noteKey: 'workOrder.finding.confirmed.note',
      partsUsed: [{ sku: 'ENC-SEAL-01', quantity: 1 }],
    });
    const closed = await a.closeWorkOrder(partner, TAMPER_WO, {
      outcome: 'repaired',
      summaryKey: 'workOrder.closure.repaired.summary',
      requestClientConfirmation: true,
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    // Closed is a claim; awaiting verification is the honest state.
    expect(closed.order.state).toBe('awaitingVerification');
    expect(closed.order.verification?.state).toBe('scheduled');
    expect(closed.order.closure?.clientConfirmation.state).toBe('requested');

    const verified = await a.runPostServiceCheck(partner, TAMPER_WO);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.order.verification?.state).toBe('passed');
    expect(verified.order.verification?.after?.value).not.toBeNull();
    expect(verified.order.state).toBe('closed');
  });

  it('reopens the order when the readings do not improve', async () => {
    const a = freshAdapter();
    const order = (await a.getWorkOrder(tech, COMPRESSOR_WO))!;
    for (const item of items(order)) {
      await a.recordChecklistItem(tech, COMPRESSOR_WO, item.id, { result: 'pass' });
    }
    await a.recordFinding(tech, COMPRESSOR_WO, {
      partId: 'compressor',
      verdict: 'confirmed',
      noteKey: 'workOrder.finding.confirmed.note',
      partsUsed: [{ sku: 'CMP-CAP-45', quantity: 1 }],
    });
    const closed = await a.closeWorkOrder(tech, COMPRESSOR_WO, {
      outcome: 'repaired',
      summaryKey: 'workOrder.closure.repaired.summary',
    });
    expect(closed.ok).toBe(true);

    const checked = await a.runPostServiceCheck(tech, COMPRESSOR_WO);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.order.verification?.state).toBe('failed');
    expect(checked.order.state).toBe('reopened');
    expect(checked.order.history.at(-1)?.to).toBe('reopened');
    expect(checked.order.history.at(-1)?.reasonKey).toBe(
      'workOrder.verification.failed.reason',
    );
    expect(checked.order.action.href).toBeTruthy();
  });

  it('refuses a post-service check on an order nobody has closed', async () => {
    const a = freshAdapter();
    expect(await a.runPostServiceCheck(tech, COMPRESSOR_WO)).toEqual({
      ok: false,
      reasonKey: 'workOrder.reject.notClosed',
    });
  });

  it('never lets a unit we cannot see count as a pass', async () => {
    // The guest unit went quiet after the visit. The work may well have
    // worked; the telemetry cannot say so, and that is not a pass.
    const quiet = (await adapter.getWorkOrder(tech, 'WO-2026-0757'))!;
    expect(quiet.state).toBe('awaitingVerification');
    expect(quiet.verification?.state).toBe('inconclusive');
    expect(quiet.verification?.after?.value).toBeNull();
    expect(quiet.verification?.after?.lastSeen).toBeTruthy();
    expect(quiet.severity).toBe('unknown');
  });

  it('records a step against a silent unit as not applicable, never as a pass', async () => {
    const unreachable = (await adapter.getWorkOrder(tech, 'WO-2026-0729'))!;
    const recorded = items(unreachable).filter((i) => i.result !== 'pending');
    expect(recorded.length).toBeGreaterThan(0);
    for (const item of recorded) {
      expect(item.result).toBe('notApplicable');
      expect(item.measurement?.observed?.value).toBeNull();
      expect(item.noteKey).toBe('workOrder.note.unitNotReporting');
    }
  });

  it('escalates with a reason instead of closing over the problem', async () => {
    const a = freshAdapter();
    const escalated = await a.escalateWorkOrder(tech, COMPRESSOR_WO, {
      reasonKey: 'workOrder.escalation.specialistRequired',
    });
    expect(escalated.ok).toBe(true);
    if (!escalated.ok) return;
    expect(escalated.order.state).toBe('escalated');
    expect(escalated.order.closure?.outcome).toBe('escalated');
    expect(escalated.order.closure?.escalationReasonKey).toBe(
      'workOrder.escalation.specialistRequired',
    );
    const again = await a.escalateWorkOrder(tech, 'WO-2026-0601', {
      reasonKey: 'workOrder.escalation.specialistRequired',
    });
    expect(again).toEqual({ ok: false, reasonKey: 'workOrder.reject.alreadyClosed' });
  });
});

describe('work orders — the seeded dataset is not all green', () => {
  it('covers every stage a screen has to render', async () => {
    const all = await adapter.listWorkOrders(admin);
    const states = new Set(all.map((o) => o.state));
    for (const state of [
      'dispatched',
      'accepted',
      'inProgress',
      'awaitingVerification',
      'closed',
      'reopened',
      'escalated',
    ]) {
      expect(states).toContain(state);
    }
  });

  it('carries a verified-by-telemetry closure and a reopened one', async () => {
    const closed = (await adapter.getWorkOrder(admin, 'WO-2026-0601'))!;
    expect(closed.state).toBe('closed');
    expect(closed.verification?.state).toBe('passed');
    const reopened = (await adapter.getWorkOrder(admin, 'WO-2026-0748'))!;
    expect(reopened.state).toBe('reopened');
    expect(reopened.verification?.state).toBe('failed');
  });

  it('gives every order an address and a provenance, and no order a dead end', async () => {
    const all = await adapter.listWorkOrders(admin);
    for (const order of all) {
      expect(order.provenance).toBe('simulated');
      expect(order.action.href).toBeTruthy();
      expect(order.action.labelKey).toMatch(/^workOrder\./);
      expect(order.slaDueAt > order.openedAt).toBe(true);
    }
    const asClient = await adapter.listWorkOrders(client);
    expect(asClient.every((o) => o.action.href.startsWith('/account/service'))).toBe(
      true,
    );
    const asTech = await adapter.listWorkOrders(tech);
    expect(asTech.every((o) => o.action.href.startsWith('/work'))).toBe(true);
  });

  it('is deterministic, and a transition on one adapter does not leak into another', async () => {
    const a = freshAdapter();
    const b = freshAdapter();
    expect(await a.listWorkOrders(admin)).toEqual(await b.listWorkOrders(admin));
    await a.recordChecklistItem(
      tech,
      COMPRESSOR_WO,
      items((await a.getWorkOrder(tech, COMPRESSOR_WO))!).find(
        (i) => i.result === 'pending',
      )!.id,
      { result: 'pass' },
    );
    const after = await b.getWorkOrder(tech, COMPRESSOR_WO);
    expect(items(after!).some((i) => i.result === 'pending')).toBe(true);
  });

  it('hands out copies, so a screen cannot edit the store by accident', async () => {
    const a = freshAdapter();
    const order = (await a.getWorkOrder(tech, COMPRESSOR_WO))!;
    order.findings.push({
      id: 'not-real',
      partId: null,
      verdict: 'confirmed',
      noteKey: 'workOrder.finding.confirmed.note',
      partsUsed: [],
      photos: [],
      recordedAt: REFERENCE_NOW,
      recordedBy: 'nobody',
      downgradesAlert: false,
    });
    const again = (await a.getWorkOrder(tech, COMPRESSOR_WO))!;
    expect(again.findings).toHaveLength(0);
  });
});
