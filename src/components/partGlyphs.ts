/**
 * The twelve part glyphs, as geometry.
 *
 * DATA, NOT MARKUP, AND THAT IS THE POINT. A glyph is a list of shapes on a
 * 24-unit grid and nothing else: there is no slot in `GlyphShape` for a fill, a
 * stroke, a stroke width or a colour, so a thirteenth glyph cannot introduce one
 * and quietly contradict the SeverityIndicator sitting beside it. `PartIcon`
 * owns every paint decision, once. Rules in a type signature cannot be forgotten
 * by turn 40; rules in a comment above a JSX map can.
 *
 * Drawn on Lucide's own terms (ADR-0006): 24-unit grid, ~20-unit live area,
 * round caps and joins, no fill, stroke from `--icon-stroke-width`. ADR-0012 has
 * why these are drawn rather than sourced, and which pairs were drawn against
 * each other on purpose — filter vs condenser coil, blower drum vs propeller.
 *
 * @requirement FR-20
 */

export type GlyphShape =
  /** `d` attribute. `rotate` spins it about the 12,12 centre — the propeller is
   *  one blade drawn three times, so the blades cannot drift apart. */
  | { readonly path: string; readonly rotate?: number }
  | { readonly rect: readonly [x: number, y: number, w: number, h: number, rx: number] }
  | { readonly circle: readonly [cx: number, cy: number, r: number] }
  | { readonly ellipse: readonly [cx: number, cy: number, rx: number, ry: number] };

/** One blade of the condenser fan, before rotation. */
const FAN_BLADE =
  'M12 9.8c-.7-3.6.5-6.3 2.6-6.3 1.9 0 2.9 2.4 1.4 4.4-1 1.3-2.4 1.9-4 1.9z';

/**
 * Keyed by the catalogue id, so a screen cannot ask for the wrong picture for a
 * part. `PartIcon.test.tsx` binds these keys to `PART_IDS` in both directions —
 * a thirteenth part added without a drawing fails the suite rather than reaching
 * the Health view as an empty box.
 */
export const PART_GLYPHS: Readonly<Record<string, readonly GlyphShape[]>> = {
  /* ---------------------------------------------------------------- indoor */
  // Framed media, waved. The fold is what separates a filter from the condenser
  // coil's flat fins. Waved rather than a sharp zigzag: three hard peaks at
  // 20 px read as the letters "MM".
  'air-filter': [
    { rect: [3, 5, 18, 14, 2] },
    { path: 'M6 15c1.5 0 1.5-6 3-6s1.5 6 3 6 1.5-6 3-6 1.5 6 3 6' },
  ],
  // Serpentine tube, deliberately unframed — the condenser coil is the framed
  // one, and the pair is the most confusable in the set.
  'evaporator-coil': [{ path: 'M4 6h11a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h11' }],
  // Squirrel-cage drum: a wheel with vanes, not a propeller.
  'blower-motor-fan': [
    { circle: [12, 12, 8] },
    { circle: [12, 12, 2.5] },
    { path: 'M8.9 8.9l1.4 1.4M15.1 8.9l-1.4 1.4M15.1 15.1l-1.4-1.4M8.9 15.1l1.4-1.4' },
  ],
  // A drop falling into a pan. Condensate is the only part whose failure mode is
  // a liquid, so the drop carries it.
  'condensate-drain-pan': [
    { path: 'M12 3.5s-2.6 3-2.6 4.6a2.6 2.6 0 0 0 5.2 0C14.6 6.5 12 3.5 12 3.5z' },
    { path: 'M4 12v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4' },
  ],
  // Slats deflecting air. Deliberately SHALLOW: at a steeper rise the three
  // blades read as a stack of chevrons, i.e. as a scroll control.
  'vents-louvers': [{ path: 'M4 9.5l8-2 8 2M4 14.5l8-2 8 2M4 19.5l8-2 8 2' }],
  /* --------------------------------------------------------------- outdoor */
  // Framed block of straight fins — flat, where the filter is folded.
  'condenser-coil': [
    { rect: [3, 6, 18, 12, 1] },
    { path: 'M7.5 6v12M12 6v12M16.5 6v12' },
  ],
  // Sealed cylinder with a discharge line.
  compressor: [
    { ellipse: [10, 7, 6, 3] },
    { path: 'M4 7v10c0 1.7 2.7 3 6 3s6-1.3 6-3V7' },
    { path: 'M16 12h5' },
  ],
  // Three-blade propeller, from one blade at 0 / 120 / 240.
  'condenser-fan-blades': [
    { circle: [12, 12, 2.2] },
    { path: FAN_BLADE },
    { path: FAN_BLADE, rotate: 120 },
    { path: FAN_BLADE, rotate: 240 },
  ],
  // The liquid and suction runs, each with a flare nut at both ends — a leak is
  // found at a joint. Diagonal because two horizontal runs with square unions
  // read as a row of sliders, i.e. as a settings control.
  'refrigerant-lines': [
    { path: 'M4 15L15 4M9 20L20 9' },
    { path: 'M2.6 13.6l2.8 2.8M13.6 2.6l2.8 2.8M7.6 18.6l2.8 2.8M18.6 7.6l2.8 2.8' },
  ],
  /* ------------------------------------------------------------ electrical */
  // Thermometer with its scale.
  'thermostat-sensors': [
    { path: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z' },
    { path: 'M14.5 8H18M14.5 11H18' },
  ],
  // The capacitor symbol itself — two plates and their leads. A technician
  // already reads this on a wiring diagram.
  'capacitor-contactor': [{ path: 'M3 12h6M15 12h6' }, { path: 'M9 5v14M15 5v14' }],
  // A run of wire between two terminals.
  'electrical-wiring': [
    { path: 'M5.5 6H9a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4h1.5' },
    { circle: [4, 6, 1.6] },
    { circle: [20, 18, 1.6] },
  ],
};

/** The ids this set can draw. The test binds these to the catalogue. */
export const PART_ICON_IDS: readonly string[] = Object.keys(PART_GLYPHS);
