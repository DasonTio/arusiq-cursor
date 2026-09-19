#!/usr/bin/env node
/**
 * verify-provenance.mjs — D6 NFR Data integrity ("100 % of figures labelled"),
 * D7 §11, §14.1, and INV-CREDIT, executed.
 *
 * This is the rule most likely to be silently dropped. It is boring, it appears
 * on every tile, and an agent under context pressure at turn 60 will forget it.
 * So it is a test, not a reminder. Retrofitting provenance means revisiting
 * every number on every screen (D7 §11) — which is exactly why it is gated from
 * commit one rather than added at the end.
 */
import { readFileSync, globSync } from 'node:fs';

const ROOT = process.env.VERIFY_ROOT ?? 'src';
const files = globSync(`${ROOT}/**/*.tsx`);
const problems = [];
const add = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

/** Components that render a measured figure. Each MUST carry `provenance`. */
const METRIC_COMPONENTS = [
  'Metric',
  'KpiTile',
  'MetricValue',
  'ChartCard',
  'SavingsChart',
  'CategoricalChart',
  'CarbonCard',
];
/** Units that mark a value as measured rather than decorative. */
const UNIT = /\d\s*(kWh|kW\b|Wh\b|W\b|kgCO₂e|kgCO2e|ppm|°C|µg\/m³|IDR|Rp\s*[\d.]|%)/;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((raw, i) => {
    const n = i + 1;
    if (/\/[/*]\s*provenance-exempt/.test(raw)) return;

    // --- A metric component without a provenance prop -----------------------
    for (const c of METRIC_COMPONENTS) {
      const open = new RegExp(`<${c}[\\s>]`);
      if (!open.test(raw)) continue;
      // look ahead to the end of the JSX opening tag
      const chunk = lines
        .slice(i, i + 12)
        .join('\n')
        .split('>')[0];
      if (!/\bprovenance\s*=/.test(chunk))
        add(
          file,
          n,
          'metric-needs-provenance',
          `<${c}> has no provenance prop — every figure declares Simulated | Estimated | Provisional | Verified (D7 §11)`,
        );
      if (/provenance\s*=\s*\{?\s*(undefined|null)/.test(chunk))
        add(file, n, 'metric-needs-provenance', `<${c}> provenance is nullish`);
    }

    // --- A bare measured figure in JSX text, outside a metric component ------
    // Stripping the tags leaves only JSX TEXT, so a properly-built
    // `<Metric unit="kWh" />` contributes nothing here and needs no exemption.
    // The previous file-level guard ("does this file mention a metric
    // component?") meant one correct Metric switched the rule off for every
    // other line in the file — the self-test caught it.
    const jsxText = raw.replace(/<[^>]*>/g, ' ');
    if (UNIT.test(jsxText)) {
      add(
        file,
        n,
        'bare-figure',
        `a measured figure appears as literal text — render it through a metric component so it carries provenance and tabular figures`,
      );
    }

    // --- INV-CREDIT: the word "credit" is Verified-only (D5 UR-CAR-08) -------
    if (/\bcredits?\b/i.test(jsxText) && !/creditCard|credit_card/i.test(raw))
      add(
        file,
        n,
        'forbidden-word-credit',
        `the word "credit" is permissible only under Verified provenance, and Phase 1A has none — say "avoided emissions" (D5 UR-CAR-08, D7 §11.2)`,
      );

    // --- INV-CO2: ppm and kgCO2e never share a card (D6 FR-66) --------------
    if (/ppm/.test(raw) && /kgCO[₂2]e/.test(raw))
      add(
        file,
        n,
        'co2-separation',
        `indoor CO₂ ppm and kgCO₂e emissions on one line — they are different quantities in different units and belong on separate cards (D5 UR-AIR-06, D7 §14.1)`,
      );
  });

  // --- INV-NO-FABRICATION: noData must not collapse into empty or zero ------
  if (/\bnoData\b/.test(src) && /(\?\?|\|\|)\s*0\b/.test(src))
    add(
      file,
      0,
      'missing-is-not-zero',
      `a nullish-coalesce to 0 alongside noData handling — a unit that has not reported is grey, not 0 kWh (D7 §11.2, §18.3)`,
    );
}

if (problems.length) {
  console.error(`\n  ✗ provenance — ${problems.length} violation(s)\n`);
  for (const p of problems)
    console.error(`      ${p.file}:${p.line}  [${p.rule}] ${p.msg}`);
  console.error('');
  process.exit(1);
}
console.log(
  `  ✓ provenance — ${files.length} file(s): every figure declares its origin`,
);
