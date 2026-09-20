/**
 * Phase 1A telemetry adapter. Screens call this; Phase 1B swaps the file.
 *
 * @requirement FR-10 FR-15 FR-34 FR-40 FR-60
 */
import {
  advanceCommand,
  nextCommandState,
  type CommandState,
} from '../domain/command.ts';
import { buildDataset, type SimDataset } from './build.ts';
import { buildCarbonSummary } from './carbon.ts';
import type { Clock } from './clock.ts';
import { fixedClock } from './clock.ts';
import { buildEnergySeries, emptyEnergySeries } from './energy.ts';
import { GRID_FACTOR } from './fixtures.ts';
import { links } from './links.ts';
import { deriveClientOverview } from './overview.ts';
import { SIMULATED_POLICY } from './policy.ts';
import {
  decideRequest,
  refreshAccountRestrictions,
  RESTRICTION_REJECT,
} from './restrictions.ts';
import {
  canSeeAsset,
  canSeeRestrictionRequest,
  canSeeUnit,
  canSeeWorkOrder,
  primaryPropertyId,
  scopedProperties,
  visibleUnitIds,
} from './scope.ts';
import {
  applyChecklistEntry,
  applyClosure,
  applyEscalation,
  applyFinding,
  applyPostServiceCheck,
  summaryFor,
  viewFor,
} from './workorders.ts';
import type {
  Alert,
  AlertCategory,
  AlertState,
  CommandProgress,
  DataScope,
  EnergySeries,
  MaintenanceEvent,
  RestrictionRequest,
  TelemetryAdapter,
  Unit,
  WorkOrder,
  WorkOrderResult,
} from './types.ts';

const clone = <T>(value: T): T => structuredClone(value);

/** The simulator's pace for the Sent → Acknowledged → Verified pipeline. Not a
 *  requirement — see the header of `policy.ts`. */
const COMMAND_TIMINGS = SIMULATED_POLICY.commandTimings;

/**
 * A command in flight, held per adapter instance.
 *
 * `state` is the furthest rung recorded so far; `getCommand` re-derives from
 * elapsed clock time and takes whichever is further, so the two ways of
 * driving progression — a moving clock and an explicit tick — cannot disagree
 * or walk the command backwards.
 */
interface CommandRecord {
  unitId: string;
  state: CommandState;
  issuedAt: string;
  change: Partial<Unit['control']>;
}

const hiddenAccount = (now: Date) => ({
  balanceIdr: { value: null, provenance: 'simulated' as const, lastSeen: null },
  dueAt: now.toISOString(),
  state: 'current' as const,
  restriction: null,
  payAction: { labelKey: 'billing.pay', href: links.billing() },
});

export const datasetAt = (now: Date): SimDataset => buildDataset(now);

export function createTelemetryAdapter(clock: Clock = fixedClock()): TelemetryAdapter {
  const dataset = datasetAt(clock());

  /** One command in flight per unit, for the life of this adapter. */
  const commands = new Map<string, CommandRecord>();

  /**
   * D7 §13.1 — only `verified` settles the control into its new position. Up
   * to that point the requested change lives on the command record and
   * nowhere else, which is what stops the UI rendering a toggle that flipped.
   */
  const settleControl = (record: CommandRecord): void => {
    const unit = dataset.index.unitById.get(record.unitId);
    if (!unit) return;
    if (record.state === 'verified') {
      const { mode, setpointC, fanSpeed } = record.change;
      if (mode !== undefined) unit.control.mode = mode;
      if (setpointC !== undefined) unit.control.setpointC = setpointC;
      if (fanSpeed !== undefined) unit.control.fanSpeed = fanSpeed;
    }
    unit.control.lastCommand = { state: record.state, at: record.issuedAt };
  };

  /** When the next rung falls due, so a UI schedules a timer instead of
   *  polling. `null` for verified, failed and queued: none of them has a next
   *  rung, and a countdown to nothing is a lie. */
  const nextStateAt = (record: CommandRecord): string | null => {
    const issued = Date.parse(record.issuedAt);
    if (record.state === 'sent') {
      return new Date(issued + COMMAND_TIMINGS.acknowledgedAfterMs).toISOString();
    }
    if (record.state === 'acknowledged') {
      return new Date(issued + COMMAND_TIMINGS.verifiedAfterMs).toISOString();
    }
    return null;
  };

  /** Recompute against the injected clock, settle, and hand back the wire
   *  shape. This is the single place a command's state is decided. */
  const projectCommand = (record: CommandRecord): CommandProgress => {
    const elapsed = clock().getTime() - Date.parse(record.issuedAt);
    record.state = advanceCommand(record.state, elapsed, COMMAND_TIMINGS);
    settleControl(record);
    return {
      unitId: record.unitId,
      state: record.state,
      issuedAt: record.issuedAt,
      change: clone(record.change),
      nextStateAt: nextStateAt(record),
    };
  };

  const findRequest = (id: string): RestrictionRequest | undefined =>
    dataset.restrictionRequests.find((request) => request.id === id);

  const findOrder = (id: string): WorkOrder | undefined =>
    dataset.workOrders.find((order) => order.id === id);
  const unitOf = (order: WorkOrder): Unit | null =>
    order.scope.unitId
      ? (dataset.index.unitById.get(order.scope.unitId) ?? null)
      : null;
  const alertOf = (order: WorkOrder): Alert | null =>
    order.brief.alertId
      ? (dataset.alerts.find((a) => a.id === order.brief.alertId) ?? null)
      : null;

  /**
   * A transition is applied to the instance's own copy of the dataset and the
   * caller gets a CLONE back. Phase 1A has no server, so this is the closest
   * honest analogue of a write: the screen cannot reach into the store, and
   * two adapters do not share a session.
   */
  const settle = (
    scope: DataScope,
    workOrderId: string,
    apply: (order: WorkOrder) => WorkOrderResult,
  ): WorkOrderResult => {
    const order = findOrder(workOrderId);
    // Out of scope and non-existent are the same answer on purpose: "no such
    // order for you" must not become an oracle for orders you cannot see.
    if (!order || !canSeeWorkOrder(dataset, scope, order)) {
      return { ok: false, reasonKey: 'workOrder.reject.notInScope' };
    }
    const result = apply(order);
    return result.ok ? { ok: true, order: viewFor(scope.role, result.order) } : result;
  };

  return {
    listProperties(scope) {
      return Promise.resolve(clone(scopedProperties(dataset, scope)));
    },

    getUnit(scope, unitId) {
      if (!canSeeUnit(dataset, scope, unitId)) return Promise.resolve(null);
      const found = dataset.index.unitById.get(unitId) ?? null;
      return Promise.resolve(found ? clone(found) : null);
    },

    getEnergy(scope, unitId, period) {
      if (!canSeeUnit(dataset, scope, unitId) && !canSeeAsset(dataset, scope, unitId)) {
        return Promise.resolve(emptyEnergySeries());
      }
      return Promise.resolve(clone(buildEnergySeries(dataset, unitId, period)));
    },

    getCarbon(scope, scopeId, period) {
      if (
        !canSeeUnit(dataset, scope, scopeId) &&
        !canSeeAsset(dataset, scope, scopeId)
      ) {
        return Promise.resolve({
          scope2KgCO2e: {
            value: null,
            provenance: 'simulated' as const,
            lastSeen: null,
          },
          avoidedKgCO2e: {
            value: null,
            provenance: 'estimated' as const,
            lastSeen: null,
          },
          gridFactor: GRID_FACTOR,
        });
      }
      return Promise.resolve(clone(buildCarbonSummary(dataset, scopeId, period)));
    },

    listAlerts(scope, filter) {
      const visible = visibleUnitIds(dataset, scope);
      const properties = new Set(scopedProperties(dataset, scope).map((p) => p.id));
      return Promise.resolve(
        clone(
          dataset.alerts.filter((alert) => {
            if (alert.scope.unitId) {
              if (!visible.has(alert.scope.unitId)) return false;
            } else if (!properties.has(alert.scope.propertyId)) {
              return false;
            }
            if (filter?.state && alert.state !== filter.state) return false;
            if (filter?.category && alert.category !== filter.category) return false;
            if (filter?.assetId) {
              const ref = alert.scope;
              if (
                ![
                  ref.propertyId,
                  ref.floorId,
                  ref.roomId,
                  ref.unitId,
                  ref.partId,
                ].includes(filter.assetId)
              ) {
                return false;
              }
            }
            return true;
          }),
        ),
      );
    },

    listMaintenance(scope, filter) {
      const visible = visibleUnitIds(dataset, scope);
      const properties = new Set(scopedProperties(dataset, scope).map((p) => p.id));
      return Promise.resolve(
        clone(
          dataset.maintenance.filter((event) => {
            if (event.scope.unitId) {
              if (!visible.has(event.scope.unitId)) return false;
            } else if (!properties.has(event.scope.propertyId)) {
              return false;
            }
            if (filter?.assetId) {
              const ref = event.scope;
              if (
                ![ref.propertyId, ref.floorId, ref.roomId, ref.unitId].includes(
                  filter.assetId,
                )
              )
                return false;
            }
            return true;
          }),
        ),
      );
    },

    listWorkOrders(scope, filter) {
      return Promise.resolve(
        dataset.workOrders
          .filter((order) => canSeeWorkOrder(dataset, scope, order))
          .filter((order) => {
            if (filter?.state && order.state !== filter.state) return false;
            if (filter?.assignedTo && order.assignedTo?.id !== filter.assignedTo)
              return false;
            if (filter?.assetId) {
              const ref = order.scope;
              if (
                ![ref.propertyId, ref.floorId, ref.roomId, ref.unitId].includes(
                  filter.assetId,
                )
              ) {
                return false;
              }
            }
            return true;
          })
          .map((order) => summaryFor(scope.role, order)),
      );
    },

    getWorkOrder(scope, workOrderId) {
      const order = findOrder(workOrderId);
      if (!order || !canSeeWorkOrder(dataset, scope, order))
        return Promise.resolve(null);
      return Promise.resolve(viewFor(scope.role, order));
    },

    recordChecklistItem(scope, workOrderId, itemId, entry) {
      return Promise.resolve(
        settle(scope, workOrderId, (order) =>
          applyChecklistEntry(
            order,
            unitOf(order),
            itemId,
            entry,
            scope.userId,
            clock().toISOString(),
          ),
        ),
      );
    },

    recordFinding(scope, workOrderId, finding) {
      return Promise.resolve(
        settle(scope, workOrderId, (order) =>
          applyFinding(order, finding, scope.userId, clock().toISOString()),
        ),
      );
    },

    closeWorkOrder(scope, workOrderId, closure) {
      return Promise.resolve(
        settle(scope, workOrderId, (order) =>
          applyClosure(
            order,
            unitOf(order),
            alertOf(order),
            closure,
            scope.userId,
            clock().toISOString(),
          ),
        ),
      );
    },

    escalateWorkOrder(scope, workOrderId, escalation) {
      return Promise.resolve(
        settle(scope, workOrderId, (order) =>
          applyEscalation(order, escalation, scope.userId, clock().toISOString()),
        ),
      );
    },

    runPostServiceCheck(scope, workOrderId) {
      return Promise.resolve(
        settle(scope, workOrderId, (order) =>
          applyPostServiceCheck(order, unitOf(order), clock().toISOString()),
        ),
      );
    },

    getAccountStanding(scope, propertyId) {
      const visible = scopedProperties(dataset, scope).some((p) => p.id === propertyId);
      if (!visible) return Promise.resolve(hiddenAccount(clock()));
      const standing = dataset.accounts[propertyId];
      return Promise.resolve(standing ? clone(standing) : hiddenAccount(clock()));
    },

    getClientOverview(scope, propertyId) {
      const properties = scopedProperties(dataset, scope);
      const chosenId = propertyId ?? primaryPropertyId(dataset, scope);
      const home =
        (chosenId ? properties.find((p) => p.id === chosenId) : null) ??
        properties[0] ??
        null;
      if (!home) return Promise.resolve(null);
      return Promise.resolve(deriveClientOverview(dataset, home, clock()));
    },

    listRestrictionRequests(scope, filter) {
      return Promise.resolve(
        clone(
          dataset.restrictionRequests.filter((request) => {
            if (!canSeeRestrictionRequest(dataset, scope, request)) return false;
            if (filter?.state && request.state !== filter.state) return false;
            if (filter?.propertyId && request.scope.propertyId !== filter.propertyId) {
              return false;
            }
            return true;
          }),
        ),
      );
    },

    getRestrictionRequest(scope, requestId) {
      const request = findRequest(requestId);
      if (!request || !canSeeRestrictionRequest(dataset, scope, request)) {
        return Promise.resolve(null);
      }
      return Promise.resolve(clone(request));
    },

    decideRestrictionRequest(scope, requestId, decision) {
      const request = findRequest(requestId);
      // Out of scope and non-existent are the same answer on purpose, exactly
      // as in `settle()` above: "no such request for you" must not become an
      // oracle for requests you are not allowed to see.
      if (!request || !canSeeRestrictionRequest(dataset, scope, request)) {
        return Promise.resolve({ ok: false, reasonKey: RESTRICTION_REJECT.notInScope });
      }
      const result = decideRequest(request, decision, {
        now: clock(),
        // An audit line reading "user-admin" answers "which account", not
        // "who decided" — and FR-52's record exists to answer the second.
        // `DataScope` carries no display name, so the caller supplies one the
        // same way it already supplies `signedOffBy`; the id stays as the
        // fallback so a caller that omits it degrades to the old behaviour
        // rather than to an empty signature.
        actorName: decision.decidedByName?.trim() || scope.userId,
        unitById: dataset.index.unitById,
        unitIdsByAsset: dataset.index.unitIdsByAsset,
        healthSensitiveUnitIds: dataset.index.healthSensitiveUnitIds,
      });
      if (!result.ok) return Promise.resolve(result);
      // An approval moved the ladder, so the account banner has to agree with
      // the unit banners. Derived, never authored twice.
      refreshAccountRestrictions(
        dataset.accounts,
        dataset.index.unitIdsByAsset,
        dataset.index.unitById,
      );
      return Promise.resolve({ ok: true, request: clone(result.request) });
    },

    async sendCommand(scope, unitId, change) {
      const issuedAt = clock().toISOString();
      const unit = await this.getUnit(scope, unitId);
      const record: CommandRecord = {
        unitId,
        state: 'sent',
        issuedAt,
        change: clone(change),
      };

      // The honest branches, kept ahead of the pipeline. A unit the caller
      // cannot see is `failed` rather than an error that confirms it exists;
      // an offline unit HOLDS the command with its time (INV-GREY, D7 §13.1);
      // and a unit whose last command failed does not silently get a second
      // one that appears to work.
      if (!unit) record.state = 'failed';
      else if (!unit.device.online) record.state = 'queued';
      else if (unit.control.lastCommand?.state === 'failed') record.state = 'failed';

      commands.set(unitId, record);
      return projectCommand(record);
    },

    getCommand(scope, unitId) {
      const record = commands.get(unitId);
      if (!record || !canSeeUnit(dataset, scope, unitId)) return Promise.resolve(null);
      return Promise.resolve(projectCommand(record));
    },

    advanceCommand(scope, unitId) {
      const record = commands.get(unitId);
      if (!record || !canSeeUnit(dataset, scope, unitId)) return Promise.resolve(null);
      record.state = nextCommandState(record.state);
      settleControl(record);
      return Promise.resolve({
        unitId: record.unitId,
        state: record.state,
        issuedAt: record.issuedAt,
        change: clone(record.change),
        nextStateAt: nextStateAt(record),
      });
    },
  };
}

export const createSimulatedAdapter = createTelemetryAdapter;
export const createSimulatedTelemetryAdapter = createTelemetryAdapter;
export const simulatedTelemetry: TelemetryAdapter = createTelemetryAdapter();
export const simulation = simulatedTelemetry;
export const simulatedTelemetryAdapter = simulatedTelemetry;

export type {
  Alert,
  AlertCategory,
  AlertState,
  EnergySeries,
  MaintenanceEvent,
  Unit,
  WorkOrder,
};
