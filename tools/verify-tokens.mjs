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
import { readFileSync, globSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SRC = process.env.VERIFY_ROOT ?? 'src';
const TOKENS_CSS = 'src/design-system/tokens.css';
const TOKENS_TS = 'src/design-system/tokens.ts';
const DOMAIN_SEVERITY = 'src/lib/domain/severity.ts';

const files = globSync(`${SRC}/**/*.{ts,tsx,css}`).filter(
  (f) => !f.endsWith('tokens.css'),
);
const problems = [];
const add = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

/** D7 §8.1 — the documented viewport frames. */
const BREAKPOINTS = new Set([320, 375, 768, 1024, 1440, 1536]);

const EXEMPT = /(^|\s)\/[/*]\s*design-system-exempt/;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.split(/\/\/|\/\*/)[0]; // ignore trailing comments
    if (EXEMPT.test(raw)) return;

    // --- Raw colour literals (D7 §2–§5) ------------------------------------
    const hex = line.match(/#[0-9A-Fa-f]{3,8}\b/);
    if (hex)
      add(
        file,
        n,
        'no-raw-color',
        `raw colour ${hex[0]} — use a token from tokens.css`,
      );
    const fn = line.match(/\b(rgba?|hsla?|color-mix)\(/);
    if (fn && !/var\(--/.test(line)) {
      // Prettier wraps long `color-mix()` calls, so the token lives on the
      // next line. Join until the call closes; a tint composed from tokens
      // is the documented legal form, not a raw colour.
      let window = line;
      if (!line.includes(')')) {
        for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
          window += ` ${lines[j].split(/\/\/|\/\*/)[0]}`;
          if (lines[j].includes(')')) break;
        }
      }
      if (!/var\(--/.test(window))
        add(
          file,
          n,
          'no-raw-color',
          `raw ${fn[1]}() — compose from a token, e.g. color-mix(in srgb, var(--color-…) 10%, …)`,
        );
    }

    // --- Raw pixel values (D7 §9) ------------------------------------------
    // 0 and 1px hairlines are allowed; everything else comes from the scale.
    //
    // Media-query conditions are the one genuine exception: a breakpoint is a
    // viewport frame (D7 §8.1), not a spacing value, and a @media condition
    // cannot read a custom property. Rather than waving them through, they are
    // checked against the documented frames — so an invented breakpoint is
    // still caught, which is the failure that actually matters.
    const isMediaCondition = /@(media|container)\b/.test(line);

    for (const m of line.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)px/g)) {
      const v = Number(m[1]);
      if (v === 0 || v === 1) continue;
      if (/--(space|radius|grid|target|focus|font-size|line-height)/.test(line))
        continue;
      if (isMediaCondition) {
        if (!BREAKPOINTS.has(v))
          add(
            file,
            n,
            'unknown-breakpoint',
            `${m[0]} is not a documented frame — D7 §8.1 defines 320·375·768·1024·1440·1536. ` +
              `An invented breakpoint is how a layout quietly stops matching the grid.`,
          );
        continue;
      }
      add(
        file,
        n,
        'no-raw-px',
        `raw ${m[0]} — use var(--space-N) (4·8·16·24·32·40·56·72·80·96·120) or a radius/target token`,
      );
    }

    // --- Raw stacking values (D7 §10.4) ------------------------------------
    const z = line.match(/z-index:\s*(-?\d+)/);
    if (z && !/var\(--z-/.test(line))
      add(
        file,
        n,
        'no-raw-z-index',
        `raw z-index ${z[1]} — use var(--z-base|sticky|dropdown|overlay|modal|toast). ` +
          `The number that beat everything else is the number the next person has to beat.`,
      );

    // --- Motion budget (D7 §10.3) ------------------------------------------
    const dur = line.match(/(\d+)ms/);
    if (dur && Number(dur[1]) > 320)
      add(
        file,
        n,
        'motion-budget',
        `${dur[0]} exceeds the 320 ms ceiling — a dashboard is a tool, not a presentation`,
      );
    if (
      /transition:[^;]*\b(width|height|top|left|right|bottom|margin|padding)\b/.test(
        line,
      )
    )
      add(
        file,
        n,
        'motion-layout',
        `transition on a layout property triggers layout every frame — animate transform/opacity only`,
      );

    // --- Dark mode is out of scope in Phase 1 (D7 §5.2) --------------------
    if (/prefers-color-scheme/.test(line))
      add(
        file,
        n,
        'light-mode-only',
        `Phase 1 is light mode only — a dark theme nobody has designed looks supported and is not`,
      );
  });
}

// --- tokens.ts must not drift from tokens.css -------------------------------
const css = readFileSync(TOKENS_CSS, 'utf8');
const ts = readFileSync(TOKENS_TS, 'utf8');
const sev = readFileSync(DOMAIN_SEVERITY, 'utf8');
const cssHas = (name) => new RegExp(`--${name}\\s*:`).test(css);

// The eleven spacing levels must exist in the CSS *and* be mirrored by the
// `space` tuple in tokens.ts, or `gap(12)` typechecks and emits a broken var().
const cssLevels = [...css.matchAll(/--space-(\d+)\s*:/g)]
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b);
const tsLevels = (ts.match(/export const space = \[([^\]]+)\]/)?.[1] ?? '')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter(Number.isFinite)
  .sort((a, b) => a - b);
if (cssLevels.join() !== tsLevels.join())
  add(
    TOKENS_TS,
    0,
    'token-sync',
    `space scale drift — tokens.css has [${cssLevels}], tokens.ts has [${tsLevels}]`,
  );
for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  if (!cssHas(`space-${lvl}`))
    add(TOKENS_CSS, 0, 'token-sync', `--space-${lvl} missing`);
for (const r of ['xs', 'sm', 'md', 'lg', 'xl', 'full'])
  if (!cssHas(`radius-${r}`)) add(TOKENS_CSS, 0, 'token-sync', `--radius-${r} missing`);
for (const z of ['base', 'sticky', 'dropdown', 'overlay', 'modal', 'toast'])
  if (!cssHas(`z-${z}`)) add(TOKENS_CSS, 0, 'token-sync', `--z-${z} missing`);
for (const s of ['critical', 'warning', 'normal', 'unknown']) {
  if (!cssHas(`color-severity-${s}-mark`))
    add(TOKENS_CSS, 0, 'token-sync', `severity ${s} mark missing`);
  if (!sev.includes(`${s}:`))
    add(
      DOMAIN_SEVERITY,
      0,
      'token-sync',
      `SEVERITY.${s} missing from lib/domain/severity.ts`,
    );
}

// --- A primitive with no fill must not name its own foreground -------------
// A component that paints no background sits on whatever surface a screen puts
// it on, so a hardcoded `color` is a guess about a surface it cannot see. The
// ghost Button guessed `--color-gray-1`: right on the three light surfaces,
// and 1.31:1 on the ADR-0005 hero, where it rendered "See carbon details" as
// near-invisible on the household landing screen.
//
// verify-contrast could not catch it — that checks tokens against the legal
// surfaces, and every token here was legal. What was wrong was the PAIRING,
// which is only knowable at the point of use. So the rule is structural: a
// transparent primitive inherits (`inherit` / `currentColor`), and the surface
// declares the foreground, as `.hero` already does.
//
// Scoped to `components/` and `patterns/`, because those are the pieces that
// can land on any surface. A feature's own class is placed by the screen that
// owns it and does know what it is sitting on.
for (const file of files.filter((f) => /\.css$/.test(f))) {
  const path = file.replace(/\\/g, '/');
  if (!/\/(components|patterns)\//.test(path)) continue;
  const source = readFileSync(file, 'utf8');
  // Crude block split is enough: these files are flat rule lists, and a
  // declaration cannot span a `}`.
  let offset = 0;
  for (const block of source.split('}')) {
    const startLine = source.slice(0, offset).split('\n').length;
    offset += block.length + 1;
    const body = block.slice(block.indexOf('{') + 1);
    if (!/background(-color)?\s*:\s*transparent/.test(body)) continue;
    const colour = body.match(
      /(?:^|[;{\s])color\s*:\s*(var\(--color-[a-z0-9-]+\)|#[0-9a-fA-F]{3,8})/,
    );
    if (!colour) continue;
    add(
      file,
      startLine + body.slice(0, colour.index).split('\n').length,
      'surface-dependent-foreground',
      `no background, but names its own colour (${colour[1]}) — a primitive ` +
        `that paints no surface must use \`inherit\` and let the surface decide`,
    );
  }
}

// --- The Figma export must not go stale ------------------------------------
// Figma is a CONSUMER of tokens.css (tools/export-figma-tokens.mjs). If someone
// changes a token and forgets to re-export, the design file and the build
// silently disagree — which is exactly D8 finding F-06, "three artefacts would
// have shipped in two identities", reproduced by omission rather than by
// argument. Regenerate and diff rather than trusting anyone to remember.
if (existsSync('design/figma-tokens.json')) {
  const committed = readFileSync('design/figma-tokens.json', 'utf8');
  const fresh = spawnSync('node', ['tools/export-figma-tokens.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, FIGMA_EXPORT_STDOUT: '1' },
  });
  const regenerated = readFileSync('design/figma-tokens.json', 'utf8');
  if (fresh.status === 0 && committed !== regenerated)
    add(
      'design/figma-tokens.json',
      0,
      'figma-export-stale',
      'out of date with tokens.css — run `npm run figma:tokens` and re-import into Figma',
    );
}

if (problems.length) {
  const byRule = {};
  for (const p of problems) (byRule[p.rule] ??= []).push(p);
  console.error(
    `\n  ✗ tokens — ${problems.length} violation(s) in ${new Set(problems.map((p) => p.file)).size} file(s)\n`,
  );
  for (const [rule, list] of Object.entries(byRule)) {
    console.error(`  [${rule}]`);
    for (const p of list.slice(0, 12))
      console.error(`      ${p.file}:${p.line}  ${p.msg}`);
    if (list.length > 12) console.error(`      … and ${list.length - 12} more`);
    console.error('');
  }
  process.exit(1);
}
console.log(`  ✓ tokens — ${files.length} file(s) use only design-system values`);
