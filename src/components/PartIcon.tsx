/**
 * The twelve monitored parts, drawn.
 *
 * Lucide has no compressor, evaporator-coil or condenser-fan glyph (ADR-0006
 * said so when it closed the icon-set gap), so these are hand-drawn on Lucide's
 * own terms: a 24 px grid, a ~20 px live area, `--icon-stroke-width`, round
 * caps and joins, no fill. Two icon sets in one row only cohere if they share a
 * stroke, so neither primitive exposes one.
 *
 * The glyphs are SCHEMATIC, not illustrative — a technician reads a part row at
 * arm's length on a phone in a plant room, and a shaded rendering of a
 * compressor at 20 px is a grey blob. See ADR-0012.
 *
 * @requirement FR-20
 */
import type { PartIconProps } from './contracts.ts';
import { useTranslation } from 'react-i18next';
import { PART_GLYPHS, type GlyphShape } from './partGlyphs.ts';
import styles from './PartIcon.module.css';

/** The one place any part glyph is painted. Geometry in, elements out. */
function draw(shape: GlyphShape, key: number) {
  if ('rect' in shape) {
    const [x, y, w, h, rx] = shape.rect;
    return <rect key={key} x={x} y={y} width={w} height={h} rx={rx} />;
  }
  if ('circle' in shape) {
    const [cx, cy, r] = shape.circle;
    return <circle key={key} cx={cx} cy={cy} r={r} />;
  }
  if ('ellipse' in shape) {
    const [cx, cy, rx, ry] = shape.ellipse;
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} />;
  }
  return (
    <path
      key={key}
      d={shape.path}
      transform={shape.rotate ? `rotate(${shape.rotate} 12 12)` : undefined}
    />
  );
}

export function PartIcon({ part, size = 24, labelled = false }: PartIconProps) {
  const { t } = useTranslation();
  const glyph = PART_GLYPHS[part];
  // Same convention as `partDefinition()` in the catalogue: an unknown part is
  // a wiring mistake, not a data state, and a silent empty box is how it ships.
  if (!glyph) throw new Error(`Unknown part id "${part}" — not one of the twelve`);

  return (
    <svg
      className={styles.root}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? t(`part.${part}`) : undefined}
      focusable="false"
    >
      {glyph.map(draw)}
    </svg>
  );
}
