import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PartIcon } from './PartIcon.tsx';
import { PART_ICON_IDS } from './partGlyphs.ts';
import { PART_IDS } from '../lib/simulation/catalogue.ts';
import i18n from '../lib/i18n/index.ts';

/**
 * ADR-0012. The interesting failures for an icon set are not "does it render"
 * — they are "is a thirteenth part silently invisible", "did two glyphs end up
 * identical", and "did someone give one of them a different stroke". All three
 * are asserted here, because none of them is visible in a code review.
 */

/** The drawing of one part, normalised for comparison. */
function shapeOf(part: string): string {
  const { container, unmount } = render(<PartIcon part={part} />);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  const markup = svg!.innerHTML.replace(/\s+/g, ' ').trim();
  unmount();
  return markup;
}

describe('PartIcon — FR-20', () => {
  it('draws every part the catalogue defines, and no part it does not', () => {
    // Bound in BOTH directions on purpose. A thirteenth part added to the
    // catalogue without a glyph would otherwise reach the Health view as an
    // empty box, and a glyph for a part that no longer exists is dead weight
    // nobody deletes.
    expect([...PART_ICON_IDS].sort()).toEqual([...PART_IDS].sort());
    expect(PART_ICON_IDS).toHaveLength(12);
  });

  it('gives each of the twelve a distinct drawing', () => {
    const shapes = new Map<string, string>();
    for (const part of PART_IDS) {
      const shape = shapeOf(part);
      expect(shape.length).toBeGreaterThan(0);
      const clash = [...shapes.entries()].find(([, s]) => s === shape);
      expect(
        clash,
        `"${part}" is drawn identically to "${clash?.[0]}" — a part row would be ambiguous`,
      ).toBeUndefined();
      shapes.set(part, shape);
    }
    expect(shapes.size).toBe(12);
  });

  it('fails loudly on an unknown part rather than rendering nothing', () => {
    // Same wording as partDefinition() in the catalogue: an unknown id is a
    // wiring mistake, and a blank space is the version of it that ships.
    expect(() => render(<PartIcon part="heat-exchanger" />)).toThrow(
      /Unknown part id "heat-exchanger" — not one of the twelve/,
    );
  });

  it('is silent to assistive technology when the part name is already beside it', () => {
    const { container } = render(<PartIcon part="compressor" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('aria-label');
  });

  it('takes its accessible name from the part catalogue when it stands alone', async () => {
    const { getByRole, unmount } = render(<PartIcon part="compressor" labelled />);
    expect(getByRole('img')).toHaveAttribute('aria-label', 'Compressor');
    unmount();

    // Asserted in Bahasa Indonesia too, because the icon resolves `part.<id>`
    // rather than carrying wording of its own — the failure this catches is a
    // glyph whose name silently stays English when the rest of the row turns.
    await i18n.changeLanguage('id');
    const second = render(<PartIcon part="compressor" labelled />);
    expect(second.getByRole('img')).toHaveAttribute('aria-label', 'Kompresor');
    second.unmount();
    await i18n.changeLanguage('en');
  });

  it('draws on the same 24-unit grid at every icon size, so the stroke never rescales', () => {
    for (const size of [16, 20, 24] as const) {
      const { container, unmount } = render(<PartIcon part="air-filter" size={size} />);
      const svg = container.querySelector('svg')!;
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('width', String(size));
      unmount();
    }
  });

  it('sets no colour of its own — the part row owns severity, the icon inherits', () => {
    // A glyph that picked its own colour could contradict the SeverityIndicator
    // sitting next to it, which is the one thing a part row must never do.
    for (const part of PART_IDS) {
      expect(shapeOf(part)).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|stroke="(?!none)/i);
    }
  });
});
