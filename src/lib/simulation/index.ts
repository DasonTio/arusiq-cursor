/**
 * The public face of the simulation layer.
 *
 * Screens import from here and from nowhere else inside `simulation/`. The
 * modules below the barrel are free to be reorganised when Phase 1B lands;
 * this list is the contract (ADR-0004).
 *
 * @requirement FR-10 FR-15
 */
export type * from './types.ts';
export {
  createSimulatedAdapter,
  createTelemetryAdapter,
  createSimulatedTelemetryAdapter,
  simulation,
  simulatedTelemetry,
  simulatedTelemetryAdapter,
  datasetAt,
} from './adapter.ts';
export { REFERENCE_NOW, fixedClock } from './clock.ts';
export type { Clock } from './clock.ts';
export {
  PART_CATALOGUE,
  PART_IDS,
  partGroupLabelKey,
  partLabelKey,
} from './catalogue.ts';
export type { PartDefinition, SignalDefinition } from './catalogue.ts';
export { GRID_FACTOR, TARIFF, BASELINE_METHOD, TECHNICIANS } from './fixtures.ts';
export { links } from './links.ts';
export { walkUnits, walkRooms } from './tree.ts';
export { asReading, isAbsent } from './readings.ts';
export { SIMULATED_POLICY, LEVER_KEYS, type LeverKey } from './policy.ts';

export { deriveClientOverview, selectClientOverview } from './overview.ts';
/** D2 O-WO — the work-order record. Screens call the adapter; these are for a
 *  caller that already holds an order and needs the same derivations. */
export {
  buildWorkOrders,
  summaryFor,
  viewFor,
  worstWorkOrderSeverity,
} from './workorders.ts';
export type { WorkOrderInputs } from './workorders.ts';
/** FR-52 / ADR-0015 — the restriction approval queue. `RESTRICTION_REJECT` is
 *  the exhaustive list of reason keys `decideRestrictionRequest` can return, so
 *  a screen can enumerate them rather than guess at the strings. */
export {
  RESTRICTION_REJECT,
  affectedUnitIds,
  currentStepAcross,
  worstRestriction,
} from './restrictions.ts';
export { RESTRICTION_REQUEST_SPECS } from './fixtures.ts';
export type { RestrictionRequestSpec } from './fixtures.ts';
export { WORK_ORDER_SPECS } from './fixtures.ts';
export type { WorkOrderSpec, WorkOrderStage } from './fixtures.ts';
export { buildEnergySeries, savingVsBaseline, trailingPeriod } from './energy.ts';
export { buildCarbonSummary } from './carbon.ts';
export type { SimDataset } from './build.ts';

export {
  authenticate,
  DEMO_ACCOUNTS,
  LOCKOUT_AFTER,
  LOCKOUT_MS,
  accountForRole,
  findDemoAccount,
} from './auth.ts';
export type { AuthResult, DemoAccount, LockState } from './auth.ts';
