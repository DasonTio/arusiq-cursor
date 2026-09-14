#!/usr/bin/env node
/**
 * verify-tokens.mjs — D7 §9, §10, §18 "Spacing consistency" and "Colour
 * semantics", executed.
 *
 * A design system survives contact with agents only if deviating from it is a
 * build failure rather than a code-review opinion. This script removes the
 * degrees of freedom: if the only reachable colours are named tokens and the
 * only reachable gaps are the eleven levels, an agent cannot invent a shade of
 * grey at 2 a.m. and nobody notices for three weeks.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const SRC = 'src';
const TOKENS_CSS = 'src/design-system/tokens.css';
const TOKENS_TS  = 'src/design-system/tokens.ts';

const files = globSync(`${SRC}/**/*.{ts,tsx,css}`).filter((f) => !f.endsWith('tokens.css'));
const problems = [];
const add = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

const EXEMPT = /(^|\s)\/[/*]\s*design-system-exempt/;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.split(/\/\/|\/\*/)[0];        // ignore trailing comments
    if (EXEMPT.test(raw)) return;

    // --- Raw colour literals (D7 §2–§5) ------------------------------------
    const hex = line.match(/#[0-9A-Fa-f]{3,8}\b/);
    if (hex) add(file, n, 'no-raw-color',
      `raw colour ${hex[0]} — use a token from tokens.css`);
    const fn = line.match(/\b(rgba?|hsla?|color-mix)\(/);
    if (fn && !/var\(--/.test(line)) add(file, n, 'no-raw-color',
      `raw ${fn[1]}() — compose from a token, e.g. color-mix(in srgb, var(--color-…) 10%, …)`);

    // --- Raw pixel values (D7 §9) ------------------------------------------
    // 0 and 1px hairlines are allowed; everything else comes from the scale.
    for (const m of line.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)px/g)) {
      const v = Number(m[1]);
      if (v === 0 || v === 1) continue;
      if (/--(space|radius|grid|target|focus|font-size|line-height)/.test(line)) continue;
      add(file, n, 'no-raw-px',
        `raw ${m[0]} — use var(--space-N) (4·8·16·24·32·40·56·72·80·96·120) or a radius/target token`);
    }

    // --- Raw stacking values (D7 §10.4) ------------------------------------
    const z = line.match(/z-index:\s*(-?\d+)/);
    if (z && !/var\(--z-/.test(line)) add(file, n, 'no-raw-z-index',
      `raw z-index ${z[1]} — use var(--z-base|sticky|dropdown|overlay|modal|toast). ` +
      `The number that beat everything else is the number the next person has to beat.`);

    // --- Motion budget (D7 §10.3) ------------------------------------------
    const dur = line.match(/(\d+)ms/);
    if (dur && Number(dur[1]) > 320) add(file, n, 'motion-budget',
      `${dur[0]} exceeds the 320 ms ceiling — a dashboard is a tool, not a presentation`);
    if (/transition:[^;]*\b(width|height|top|left|right|bottom|margin|padding)\b/.test(line))
      add(file, n, 'motion-layout',
        `transition on a layout property triggers layout every frame — animate transform/opacity only`);

    // --- Dark mode is out of scope in Phase 1 (D7 §5.2) --------------------
    if (/prefers-color-scheme/.test(line)) add(file, n, 'light-mode-only',
      `Phase 1 is light mode only — a dark theme nobody has designed looks supported and is not`);
  });
}

// --- tokens.ts must not drift from tokens.css -------------------------------
const css = readFileSync(TOKENS_CSS, 'utf8');
const ts  = readFileSync(TOKENS_TS, 'utf8');
const cssHas = (name) => new RegExp(`--${name}\\s*:`).test(css);

for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  if (!cssHas(`space-${lvl}`)) add(TOKENS_CSS, 0, 'token-sync', `--space-${lvl} missing`);
for (const r of ['xs', 'sm', 'md', 'lg', 'xl', 'full'])
  if (!cssHas(`radius-${r}`)) add(TOKENS_CSS, 0, 'token-sync', `--radius-${r} missing`);
for (const z of ['base', 'sticky', 'dropdown', 'overlay', 'modal', 'toast'])
  if (!cssHas(`z-${z}`)) add(TOKENS_CSS, 0, 'token-sync', `--z-${z} missing`);
for (const s of ['critical', 'warning', 'normal', 'unknown']) {
  if (!cssHas(`color-severity-${s}-mark`)) add(TOKENS_CSS, 0, 'token-sync', `severity ${s} mark missing`);
  if (!ts.includes(`${s}:`)) add(TOKENS_TS, 0, 'token-sync', `SEVERITY.${s} missing from tokens.ts`);
}

if (problems.length) {
  const byRule = {};
  for (const p of problems) (byRule[p.rule] ??= []).push(p);
  console.error(`\n  ✗ tokens — ${problems.length} violation(s) in ${new Set(problems.map(p => p.file)).size} file(s)\n`);
  for (const [rule, list] of Object.entries(byRule)) {
    console.error(`  [${rule}]`);
    for (const p of list.slice(0, 12)) console.error(`      ${p.file}:${p.line}  ${p.msg}`);
    if (list.length > 12) console.error(`      … and ${list.length - 12} more`);
    console.error('');
  }
  process.exit(1);
}
console.log(`  ✓ tokens — ${files.length} file(s) use only design-system values`);
