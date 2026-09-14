/**
 * Simulated telemetry adapter — the Phase 1B seam.
 *
 * ADR-0004: this interface is written BEFORE the data, so it is shaped by the
 * eventual API rather than by whatever the first screen found convenient.
 * Phase 1B swaps the implementation; the screens must not change.
 *
 * Every value carries `provenance` stamped AT THE SOURCE. Provenance is a
 * property of the value, not a decoration the UI adds — otherwise aggregates
 * cannot compute their own and every new screen is a fresh chance to forget.
 *
 * @requirement FR-15 FR-60
 */
import type { Severity } from '../domain/severity.ts';
import type { Provenance } from '../domain/provenance.ts';
import type { CommandState } from '../domain/command.ts';
import type { RestrictionStep } from '../domain/restriction.ts';

/**
 * The core wrapper. A reading is never a bare number, because a bare number
 * cannot answer "how do you know?" or "when was this?".
 *
 * `value: null` means NOT REPORTED. It is never coerced to 0 — "missing is not
 * zero" (D7 §11.2). When null, `lastSeen` says when the value was last real.
 */
export interface Reading<T = number> {
  value: T | null;
  provenance: Provenance;
  /** ISO 8601. Required when `value` is null. */
  lastSeen: string | null;
}

/** A sensor that is not fitted is STATED AS ABSENT, not shown as empty
 *  (D6 FR-63). This is distinct from a fitted sensor that has gone quiet. */
export interface AbsentSensor {
  kind: 'absent';
  sensorKey: string;
}

export type MaybeReading<T = number> = Reading<T> | AbsentSensor;

/* ------------------------------------------------------------------ assets */

export type Category = 'home' | 'office';

export interface AssetNode {
  id: string;
  nameKey: string | null;
  /** Free-text names come from data, not locale packs; `nameKey` is for
   *  system-generated names such as "Floor 1". */
  name: string;
  /** D7 §4.2 — worst status of children, with the contributing count so the
   *  roll-up is inspectable rather than a bare colour. */
  rollUp: { severity: Severity; contributing: number; total: number };
}

export interface Property extends AssetNode { category: Category; floors: Floor[] }
export interface Floor extends AssetNode { rooms: Room[] }
export interface Room extends AssetNode {
  units: Unit[];
  /** D6 FR-53 — blocks the `stop` rung of the restriction ladder. */
  healthSensitive: boolean;
}

/* ------------------------------------------------------------------- units */

export type PartGroup = 'indoor' | 'outdoor' | 'electrical';

/** One of the twelve monitored components (D6 FR-20). */
export interface Part {
  id: string;
  group: PartGroup;
  severity: Severity;
  /** D6 FR-25 — suspected until a technician verdict. */
  suspected: boolean;
  signals: { key: string; reading: MaybeReading }[];
}

export interface Unit extends AssetNode {
  brand: string;
  parts: Part[];
  live: {
    temperatureC: MaybeReading;
    humidityPct: MaybeReading;
    powerW: MaybeReading;
    energyTodayKWh: MaybeReading;
    co2Ppm: MaybeReading;
    pm25: MaybeReading;
  };
  control: {
    mode: 'cool' | 'fan' | 'eco' | 'off';
    setpointC: number;
    fanSpeed: 1 | 2 | 3 | 'auto';
    lastCommand: { state: CommandState; at: string } | null;
  };
  /** D7 §14.5 — device trust. Tamper is its own category, not a fault. */
  device: {
    online: boolean;
    lastHeartbeat: string | null;
    tamperSuspected: boolean;
    maintenanceMode: boolean;
  };
  restriction: { step: RestrictionStep; graceEndsAt: string } | null;
}

/* ------------------------------------------------------------------ energy */

export interface EnergySeries {
  actual: { t: string; kWh: number }[];
  /** The counterfactual: what the unit WOULD have consumed. */
  baseline: { t: string; kWh: number }[];
  /** D6 FR-61 — the method is published, versioned and dated inside the
   *  product; the chart is not permitted without a link to it. */
  method: { id: string; version: string; href: string };
  /** Below 90 % makes a derived MRV package provisional (D6 FR-71). */
  completeness: number;
  provenance: Provenance;
  /** D6 FR-62 — savings attributed to the lever that produced them. */
  levers: { key: string; kWh: number }[];
}

export interface CarbonSummary {
  scope2KgCO2e: Reading;
  avoidedKgCO2e: Reading;
  /** D6 FR-70 — displayed, never hidden. */
  gridFactor: { value: number; source: string; effectiveFrom: string };
}

/* ----------------------------------------------------------------- adapter */

/**
 * The seam. Phase 1B replaces the implementation with real ingestion; nothing
 * above this line changes. Async by design even though the Phase 1A
 * implementation is synchronous — a synchronous signature here would force
 * every consuming screen to be rewritten when the network arrives.
 */
export interface TelemetryAdapter {
  listProperties(scope: { role: string; userId: string }): Promise<Property[]>;
  getUnit(unitId: string): Promise<Unit | null>;
  getEnergy(unitId: string, period: { from: string; to: string }): Promise<EnergySeries>;
  getCarbon(scopeId: string, period: { from: string; to: string }): Promise<CarbonSummary>;
  /** Returns the lifecycle state; callers render Sent → Acknowledged →
   *  Verified rather than flipping the control (D7 §13.1). */
  sendCommand(unitId: string, change: Partial<Unit['control']>): Promise<{ state: CommandState }>;
}
