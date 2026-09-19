import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProvenanceChip } from './ProvenanceChip.tsx';

describe('ProvenanceChip — FR-15', () => {
  it('labels the figure from the locale, not from a literal', () => {
    render(<ProvenanceChip provenance="simulated" />);
    expect(screen.getByText('Simulated')).toBeInTheDocument();
  });

  it('defaults to the light treatment when no surface is given', () => {
    render(<ProvenanceChip provenance="estimated" />);
    expect(screen.getByText('Estimated')).toHaveAttribute('data-surface', 'page');
  });

  it('carries the inverse treatment on the ADR-0005 hero, label unchanged', () => {
    render(<ProvenanceChip provenance="simulated" surface="inverse" />);
    // Still the same localised word: the hero changes the measured foreground
    // pair, never the provenance itself.
    expect(screen.getByText('Simulated')).toHaveAttribute('data-surface', 'inverse');
  });
});
