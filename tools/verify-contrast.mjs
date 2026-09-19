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

/* --- CIEDE2000 + dichromat simulation, for the categorical ramp -----------
 * A contrast ratio proves a series is visible against the page. It does not
 * prove two series are distinguishable FROM EACH OTHER, and it does not prove
 * a series cannot be mistaken for a severity. Those are the two ways a
 * categorical ramp actually fails, so ADR-0011's floors are measured here
 * rather than asserted in prose. */
const lab = (hex) => {
  const [r, g, b] = rgb(hex).map(srgb);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(X / 0.95047), f(Y), f(Z / 1.08883)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
function deltaE([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const [ap1, ap2] = [(1 + G) * a1, (1 + G) * a2];
  const [Cp1, Cp2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)];
  const ang = (b, ap) =>
    b === 0 && ap === 0 ? 0 : (Math.atan2(b, ap) * deg + 360) % 360;
  const [hp1, hp2] = [ang(b1, ap1), ang(b2, ap2)];
  const [dLp, dCp] = [L2 - L1, Cp2 - Cp1];
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * rad) / 2);
  const [Lbp, Cbp] = [(L1 + L2) / 2, (Cp1 + Cp2) / 2];
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hbp < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt =
    -Math.sin(2 * (30 * Math.exp(-(((hbp - 275) / 25) ** 2))) * rad) *
    (2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)));
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}
/** Viénot, Brettel & Mollon (1999) — the standard dichromat projection. */
const deuteranope = (hex) => {
  const mul = (m, v) => m.map((r) => r.reduce((s, k, i) => s + k * v[i], 0));
  const lin = rgb(hex).map((c) => srgb(c) * 255);
  const lms = mul(
    [
      [17.8824, 43.5161, 4.11935],
      [3.45565, 27.1554, 3.86714],
      [0.0299566, 0.184309, 1.46709],
    ],
    lin,
  );
  const out = mul(
    [
      [0.080944, -0.130504, 0.116721],
      [-0.0102485, 0.0540194, -0.113615],
      [-0.000365294, -0.00412163, 0.693513],
    ],
    mul(
      [
        [1, 0, 0],
        [0.494207, 0, 1.24827],
        [0, 0, 1],
      ],
      lms,
    ),
  );
  return (
    '#' +
    out
      .map((v) => {
        const c = Math.max(0, Math.min(255, v)) / 255;
        const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(255 * s)
          .toString(16)
          .padStart(2, '0');
      })
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
 *  a dark SURFACE, not a dark MODE, so the whole palette is not re-derived.
 *  The surface is read from --surface-inverse rather than named here, so moving
 *  the hero (as ADR-0009 did) re-measures everything that sits on it. */
const inverseRef = css.match(/--surface-inverse:\s*var\(--color-([\w-]+)\)/);
if (!inverseRef)
  throw new Error('--surface-inverse must point at a --color-* token in tokens.css');
const INVERSE = [`inverse (${inverseRef[1]})`, T(inverseRef[1])];

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

// --- Categorical chart ramp · ADR-0011 · a series stroke is non-text: 3:1 ---
const CHART = [1, 2, 3, 4, 5, 6].map((n) => T(`chart-${n}`));
CHART.forEach((hex, i) => check(`chart-${i + 1} (series)`, hex, 'ui'));

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

/* --- Categorical ramp separation · ADR-0011 ------------------------------
 * Three floors, all measured, none of them a contrast ratio:
 *   · no two series collide for a reader with typical colour vision
 *   · the first THREE — the triple the Figma legend actually draws, and the
 *     only set the ramp guarantees on colour alone — survive deuteranopia
 *   · no series can be mistaken for a severity mark, because in this product
 *     a green line would read as "healthy" rather than as "series 2"
 * Floors sit just under the measured values, so re-tuning one hex to taste
 * fails here instead of quietly collapsing two properties into one colour. */
const SEP_ALL = 18; // measured min 19.2 · chart-5/chart-6
const SEP_TRIPLE_DEUTAN = 22; // measured min 25.4 · chart-2/chart-3
const SEP_SEVERITY = 13; // measured min 14.4 · chart-1 vs unknown mark
console.log('\n  Categorical ramp separation (CIEDE2000 — ADR-0011)');
console.log('  ' + '─'.repeat(104));
let sepAll = Infinity;
let sepAllPair = '';
for (let i = 0; i < CHART.length; i += 1)
  for (let j = i + 1; j < CHART.length; j += 1) {
    const d = deltaE(lab(CHART[i]), lab(CHART[j]));
    if (d < sepAll) [sepAll, sepAllPair] = [d, `chart-${i + 1}/chart-${j + 1}`];
    if (d < SEP_ALL)
      failures.push(
        `chart-${i + 1}/chart-${j + 1} differ by only ${d.toFixed(1)} ΔE in typical ` +
          `colour vision — needs ${SEP_ALL}. Two properties would share one colour.`,
      );
  }
let sepTri = Infinity;
let sepTriPair = '';
for (let i = 0; i < 3; i += 1)
  for (let j = i + 1; j < 3; j += 1) {
    const d = deltaE(lab(deuteranope(CHART[i])), lab(deuteranope(CHART[j])));
    if (d < sepTri) [sepTri, sepTriPair] = [d, `chart-${i + 1}/chart-${j + 1}`];
    if (d < SEP_TRIPLE_DEUTAN)
      failures.push(
        `chart-${i + 1}/chart-${j + 1} differ by only ${d.toFixed(1)} ΔE under ` +
          `deuteranopia — needs ${SEP_TRIPLE_DEUTAN}. The first three are the ` +
          `only series the ramp guarantees without a dash pattern.`,
      );
  }
let sepSev = Infinity;
let sepSevPair = '';
for (const lvl of ['critical', 'warning', 'normal', 'unknown'])
  CHART.forEach((hex, i) => {
    const d = deltaE(lab(hex), lab(T(`severity-${lvl}-mark`)));
    if (d < sepSev) [sepSev, sepSevPair] = [d, `chart-${i + 1} vs ${lvl}`];
    if (d < SEP_SEVERITY)
      failures.push(
        `chart-${i + 1} is ${d.toFixed(1)} ΔE from the ${lvl} severity mark — ` +
          `needs ${SEP_SEVERITY}. A series colour must say WHICH, never HOW.`,
      );
  });
console.log(
  `  series vs series, typical vision       min ${sepAll.toFixed(1)} ΔE  (${sepAllPair})`.padEnd(
    72,
  ) + `floor ${SEP_ALL}`,
);
console.log(
  `  chart-1..3, deuteranope                min ${sepTri.toFixed(1)} ΔE  (${sepTriPair})`.padEnd(
    72,
  ) + `floor ${SEP_TRIPLE_DEUTAN}`,
);
console.log(
  `  series vs severity mark                min ${sepSev.toFixed(1)} ΔE  (${sepSevPair})`.padEnd(
    72,
  ) + `floor ${SEP_SEVERITY}`,
);

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
