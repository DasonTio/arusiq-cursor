/**
 * The twelve monitored parts, and the signals that classify each one.
 *
 * D6 FR-20 — "monitor every aspect" is an enumerated list, not a slogan. The
 * canonical IDs and signal names come from
 * `context/requirements/requirements.json → monitoredParts`; this file adds
 * the numbers the simulator needs to produce evidence, because an alert
 * without a measurement and a threshold is not an alert (D6 FR-21).
 *
 * NOTE ON THE NUMBERS: the source documents name the signals and do not fix
 * their envelopes. Nominals and thresholds here are plausible working values
 * for a residential split unit, kept in one table so a real envelope replaces
 * them in one edit. They are not quoted from any document.
 *
 * @requirement FR-20 FR-65
 */
import type { PartGroup } from './types.ts';
import type { SignalClass } from './types.ts';

/** Which side of the threshold is the failure. A superheat signal fails
 *  DOWNWARD; treating every signal as "high is bad" would invert two of the
 *  twelve parts. */
export type BreachDirection = 'above' | 'below';

export interface SignalDefinition {
  key: string;
  /** SI symbol. International, so it is not localised; the label is. */
  unit: string;
  nominal: number;
  threshold: number;
  direction: BreachDirection;
  decimals: number;
}

export interface PartDefinition {
  id: string;
  group: PartGroup;
  /** D6 FR-20 — acute signals name the measurement that breached; slow
   *  signals are reported as a trend with a projected failure date. */
  signalClass: SignalClass;
  signals: SignalDefinition[];
}

const sig = (
  key: string,
  unit: string,
  nominal: number,
  threshold: number,
  direction: BreachDirection = 'above',
  decimals = 1,
): SignalDefinition => ({ key, unit, nominal, threshold, direction, decimals });

export const PART_CATALOGUE: readonly PartDefinition[] = [
  /* ---------------------------------------------------------------- indoor */
  {
    id: 'air-filter',
    group: 'indoor',
    signalClass: 'slow',
    signals: [
      sig('pressureDrop', 'Pa', 45, 120),
      sig('runHours', 'h', 1200, 2000, 'above', 0),
    ],
  },
  {
    id: 'evaporator-coil',
    group: 'indoor',
    signalClass: 'slow',
    signals: [sig('approachTemp', 'K', 6, 12), sig('frost', 'min', 0, 15, 'above', 0)],
  },
  {
    id: 'blower-motor-fan',
    group: 'indoor',
    signalClass: 'acute',
    signals: [
      sig('current', 'A', 0.9, 1.4, 'above', 2),
      sig('vibration', 'mm/s', 1.8, 4.5),
    ],
  },
  {
    id: 'condensate-drain-pan',
    group: 'indoor',
    signalClass: 'acute',
    signals: [
      sig('level', 'mm', 8, 25, 'above', 0),
      sig('overflow', 'n', 0, 1, 'above', 0),
    ],
  },
  {
    id: 'vents-louvers',
    group: 'indoor',
    signalClass: 'acute',
    signals: [
      sig('airflow', 'm³/h', 520, 380, 'below', 0),
      sig('actuator', 'n', 0, 1, 'above', 0),
    ],
  },
  /* --------------------------------------------------------------- outdoor */
  {
    id: 'condenser-coil',
    group: 'outdoor',
    signalClass: 'slow',
    signals: [sig('dischargeVsAmbient', 'K', 18, 28)],
  },
  {
    id: 'compressor',
    group: 'outdoor',
    signalClass: 'acute',
    signals: [
      sig('current', 'A', 6.2, 8.5, 'above', 2),
      sig('cycling', '1/h', 4, 9, 'above', 0),
      sig('vibration', 'mm/s', 2.4, 6.0),
    ],
  },
  {
    id: 'condenser-fan-blades',
    group: 'outdoor',
    signalClass: 'acute',
    signals: [
      sig('current', 'A', 0.7, 1.1, 'above', 2),
      sig('imbalance', 'mm/s', 1.5, 4.0),
    ],
  },
  {
    id: 'refrigerant-lines',
    group: 'outdoor',
    signalClass: 'slow',
    signals: [
      sig('superheat', 'K', 6.5, 3.0, 'below'),
      sig('subcooling', 'K', 8.0, 4.0, 'below'),
    ],
  },
  /* ------------------------------------------------------------ electrical */
  {
    id: 'thermostat-sensors',
    group: 'electrical',
    signalClass: 'slow',
    signals: [
      sig('drift', 'K', 0.3, 1.5, 'above', 2),
      sig('disagreement', 'K', 0.4, 2.0, 'above', 2),
    ],
  },
  {
    id: 'capacitor-contactor',
    group: 'electrical',
    signalClass: 'acute',
    signals: [
      sig('startCurrent', 'A', 22, 34, 'above', 0),
      sig('chatter', 'n', 0, 3, 'above', 0),
    ],
  },
  {
    id: 'electrical-wiring',
    group: 'electrical',
    signalClass: 'acute',
    signals: [
      sig('voltageSag', 'V', 219, 198, 'below', 0),
      sig('harmonics', '%', 3.2, 8.0),
    ],
  },
];

export type PartId = (typeof PART_CATALOGUE)[number]['id'];

export const PART_IDS: readonly string[] = PART_CATALOGUE.map((p) => p.id);

export const partDefinition = (id: string): PartDefinition => {
  const found = PART_CATALOGUE.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown part id "${id}" — not one of the twelve`);
  return found;
};

/** i18n keys. The adapter never emits the words themselves (D5 UR-LANG-01). */
export const partLabelKey = (id: string): string => `part.${id}`;
export const partGroupLabelKey = (group: PartGroup): string => `partGroup.${group}`;
export const signalLabelKey = (partId: string, signalKey: string): string =>
  `signal.${partId}.${signalKey}`;
