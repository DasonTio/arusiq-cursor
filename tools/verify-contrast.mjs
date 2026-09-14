#!/usr/bin/env node
/**
 * verify-contrast.mjs — D7 §19.1 accessibility bar, executed.
 *
 * Reads src/design-system/tokens.css and proves every colour token clears its
 * WCAG 2.1 bar against ALL FOUR legal surfaces (D7 §5.2), not against white
 * alone. A design system whose contrast is claimed in a document drifts the
 * first time a token changes; a design system whose contrast is a test cannot.
 *
 * Bars (D7 §19.1):
 *   body text and status text ...................... 4.5:1
 *   severity marks, control borders, focus rings ... 3.0:1
 */
import { readFileSync } from 'node:fs';

const TOKENS = new URL('../src/design-system/tokens.css', import.meta.url);

const srgb = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Composite `fg` at `alpha` over opaque `bg` — the D7 §3.2 "10 % tint" surface. */
const tint = (fg, bg, alpha = 0.1) => {
  const [f, b] = [rgb(fg), rgb(bg)];
  return (
    '#' +
    f
      .map((c, i) =>
        Math.round(c * alpha + b[i] * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};

const css = readFileSync(TOKENS, 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/(--color-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [
    m[1],
    m[2].toUpperCase(),
  ]),
);
const T = (n) => {
  const v = tokens[`--color-${n}`];
  if (!v) throw new Error(`token --color-${n} missing from tokens.css`);
  return v;
};

const SURFACES = [
  ['page (white-1)', T('white-1')],
  ['raised (white-2)', T('white-2')],
  ['sunken (gray-5)', T('gray-5')],
];

/** ADR-0005 — the dark hero is a fifth legal surface, scoped to one component.
 *  Only the tokens that actually appear on it are checked against it; this is
 *  a dark SURFACE, not a dark MODE, so the whole palette is not re-derived. */
const INVERSE = ['inverse (brand-primary-deep)', T('brand-primary-deep')];

const failures = [];
const rows = [];

/**
 * @param {'text'|'ui'} kind
 * @param {Array} extraSurfaces  measured IN ADDITION to the three light surfaces
 * @param {Array|null} onlySurfaces  measured INSTEAD of them — for tokens that
 *   exist solely for one surface, such as the ADR-0005 hero. Checking an
 *   inverse token against white is meaningless: it is never rendered there.
 */
function check(label, fg, kind, extraSurfaces = [], onlySurfaces = null) {
  const bar = kind === 'text' ? 4.5 : 3.0;
  const base = onlySurfaces ?? [...SURFACES, ...extraSurfaces];
  const results = base.map(([sName, sHex]) => {
    const r = ratio(fg, sHex);
    if (r < bar)
      failures.push(
        `${label} (${fg}) is ${r.toFixed(2)}:1 on ${sName} — needs ${bar}:1`,
      );
    return r;
  });
  rows.push({ label, fg, bar, results });
}

// --- Status / severity text: 4.5:1, including on its own 10 % callout tint ---
for (const n of [
  'state-info-text',
  'state-eco-text',
  'state-success-text',
  'state-warning-text',
  'state-error-text',
]) {
  const fill = T(n.replace('-text', ''));
  check(n, T(n), 'text', [['own 10% tint', tint(fill, T('white-1'))]]);
}
for (const lvl of ['critical', 'warning', 'normal', 'unknown']) {
  const mark = T(`severity-${lvl}-mark`);
  check(`severity-${lvl}-text`, T(`severity-${lvl}-text`), 'text', [
    ['own 10% tint', tint(mark, T('white-1'))],
  ]);
}

// --- Severity marks are non-text interface elements: 3:1 (D7 §4.1) ----------
for (const lvl of ['critical', 'warning', 'normal', 'unknown']) {
  check(`severity-${lvl}-mark`, T(`severity-${lvl}-mark`), 'ui');
}

// --- Inverse surface · ADR-0005 · only what appears on the hero ------------
check('on-inverse (white-1)', T('white-1'), 'text', [], [INVERSE]);
check('on-inverse-muted', T('on-inverse-muted'), 'text', [], [INVERSE]);
check('eco-on-inverse', T('eco-on-inverse'), 'text', [], [INVERSE]);
check('border-on-inverse', T('border-on-inverse'), 'ui', [], [INVERSE]);
for (const lvl of ['critical', 'warning', 'normal', 'unknown'])
  check(`sev-${lvl}-mark on inv`, T(`severity-${lvl}-mark`), 'ui', [], [INVERSE]);

// --- Body + meta text, control borders, focus ring -------------------------
check('gray-1 (body text)', T('gray-1'), 'text');
check('gray-2 (meta text)', T('gray-2'), 'text');
check('black-1 (headings)', T('black-1'), 'text');
check('gray-3 (control border)', T('gray-3'), 'ui');
check('brand-primary', T('brand-primary'), 'text');
check('brand-red (button fill)', T('brand-red'), 'ui');

// --- Text placed ON a fill: the pairing is fixed by the component (D7 §3.3) -
// NOTE: there is deliberately no `white on severity-*-mark` row. No single
// foreground clears 4.5:1 across all four severity marks (warning tops out at
// 4.24:1 on black-1, unknown at 4.34:1 on white), so a solid-filled severity
// badge is not constructible. Severity renders as the D7 §3.2 preferred
// pattern instead: 10 % tint + text-safe foreground + hairline mark border.
const ON_FILL = [
  ['brand-primary', 'white-1'],
  ['brand-primary-deep', 'white-1'],
  ['brand-red', 'white-1'],
  ['state-eco', 'white-1'],
  ['state-warning', 'black-1'],
  ['state-success', 'black-1'],
  ['state-error', 'black-1'],
];
console.log(
  '\n  Foreground                          ' +
    SURFACES.map(([n]) => n.padEnd(16)).join('') +
    'own tint   bar',
);
console.log('  ' + '─'.repeat(104));
for (const { label, fg, bar, results } of rows) {
  const cells = results
    .map((r) => {
      const s = `${r.toFixed(2)}:1`;
      return (r < bar ? `✗ ${s}` : `  ${s}`).padEnd(16);
    })
    .join('');
  console.log(
    `  ${label.padEnd(26)} ${fg}  ${cells}${' '.repeat(Math.max(0, 42 - cells.length))}${bar}:1`,
  );
}

console.log(
  '\n  Text on a fill (pairing is fixed in the component, never chosen per screen)',
);
console.log('  ' + '─'.repeat(104));
for (const [fill, fgName] of ON_FILL) {
  const r = ratio(T(fill), T(fgName));
  const ok = r >= 4.5;
  if (!ok) failures.push(`${fgName} on ${fill} is ${r.toFixed(2)}:1 — needs 4.5:1`);
  console.log(
    `  ${(fgName + ' on ' + fill).padEnd(52)} ${ok ? ' ' : '✗'} ${r.toFixed(2)}:1`,
  );
}

if (failures.length) {
  console.error(
    `\n  ✗ ${failures.length} contrast failure(s):\n` +
      failures.map((f) => `      · ${f}`).join('\n') +
      '\n',
  );
  process.exit(1);
}
console.log(
  `\n  ✓ contrast — ${rows.length + ON_FILL.length} checks pass against all legal surfaces\n`,
);
