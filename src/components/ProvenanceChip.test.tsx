/**
 * ADR-0020 suppressed the DISPLAY of provenance, not the guarantee. These
 * tests hold that line: the chip renders nothing, and the data behind it is
 * untouched, so the decision is reversible and INV-AGGREGATE still means
 * something.
 *
 * @requirement FR-15
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProvenanceChip } from './ProvenanceChip.tsx';
import { PROVENANCE, weakestProvenance } from '../lib/domain/provenance.ts';

describe('ProvenanceChip — suppressed by ADR-0020', () => {
  it('renders nothing for every provenance', () => {
    for (const provenance of Object.keys(PROVENANCE) as (keyof typeof PROVENANCE)[]) {
      const { container } = render(<ProvenanceChip provenance={provenance} />);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it('renders nothing on the hero either', () => {
    const { container } = render(
      <ProvenanceChip provenance="simulated" surface="inverse" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the guarantee behind the chip is still intact', () => {
  it('keeps a locale key for every provenance, so the labels can come back', () => {
    // Restoring the display is deleting two lines in ProvenanceChip. That is
    // only true while the mapping below still exists.
    for (const [name, entry] of Object.entries(PROVENANCE)) {
      expect(entry.labelKey).toBe(`provenance.${name}`);
    }
  });

  it('still computes the weakest provenance of an aggregate — INV-AGGREGATE', () => {
    // The rule that one simulated input makes a whole total simulated is a
    // DATA rule. Hiding the label must not have quietly disabled it.
    expect(weakestProvenance(['verified', 'simulated'])).toBe('simulated');
    expect(weakestProvenance(['verified', 'provisional'])).toBe('provisional');
    expect(weakestProvenance(['verified', 'verified'])).toBe('verified');
  });
});
