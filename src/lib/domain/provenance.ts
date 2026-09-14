/**
 * Provenance — where a figure came from and how far it has been verified.
 *
 * D6 NFR Data integrity requires 100 % of figures to be labelled. Provenance is
 * a property of the VALUE, not a decoration the UI adds (ADR-0004): otherwise
 * aggregates cannot compute their own, and every new screen is a fresh chance
 * to forget.
 *
 * @requirement FR-71
 */

export const PROVENANCE = {
  simulated: { rank: 0, labelKey: 'provenance.simulated' },
  estimated: { rank: 1, labelKey: 'provenance.estimated' },
  provisional: { rank: 2, labelKey: 'provenance.provisional' },
  verified: { rank: 3, labelKey: 'provenance.verified' },
} as const;

export type Provenance = keyof typeof PROVENANCE;

/**
 * D8 — an aggregate inherits the WEAKEST provenance of its inputs. One
 * simulated reading makes the whole total simulated.
 */
export const weakestProvenance = (inputs: readonly Provenance[]): Provenance =>
  inputs.reduce<Provenance>(
    (weakest, p) => (PROVENANCE[p].rank < PROVENANCE[weakest].rank ? p : weakest),
    'verified',
  );

/**
 * D5 UR-CAR-08 / D7 §11.2 — "verified" is the only provenance under which the
 * word *credit* is permissible. Everything else says *avoided emissions*.
 * Phase 1A has no verified data, so this returns false throughout.
 */
export const mayUseWordCredit = (p: Provenance): boolean => p === 'verified';
