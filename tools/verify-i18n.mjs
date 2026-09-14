#!/usr/bin/env node
/**
 * verify-i18n.mjs — D5 UR-LANG-01/02, D7 §19.2, executed.
 *
 * "Any further language as a locale pack WITHOUT A CODE CHANGE" is only true if
 * no user-facing string ever reaches a component. Agents are excellent at
 * writing fluent English directly into JSX, so this has to be mechanical.
 *
 * Also enforces the harder half: Indonesian runs 20–30 % longer than English,
 * so nothing may be sized to its English label.
 */
import { readFileSync, globSync } from 'node:fs';

const files = globSync('src/**/*.tsx');
const problems = [];
const add = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

const TEXT_PROPS = /\b(placeholder|aria-label|title|alt|label|aria-description)\s*=\s*"([^"]{2,})"/g;
const WORDS = /[A-Za-z]{2,}/;
/** Tolerated: pure markup, entities, numbers, single letters, code-ish tokens. */
const IGNORE = /^[\s\d\p{P}\p{S}]*$/u;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((raw, i) => {
    const n = i + 1;
    // Exemption applies to the line it sits on or the line it precedes,
    // matching the eslint-disable-next-line convention agents already know.
    const exempt = /i18n-exempt/;
    if (exempt.test(raw) || (i > 0 && exempt.test(lines[i - 1]))) return;

    // --- Literal text between JSX tags --------------------------------------
    for (const m of raw.matchAll(/>([^<>{}\n]{2,})</g)) {
      const text = m[1].trim();
      if (IGNORE.test(text) || !WORDS.test(text)) continue;
      add(file, n, 'hardcoded-text',
        `literal UI text "${text.slice(0, 44)}" — route it through t('key') so a locale pack can replace it (D5 UR-LANG-01)`);
    }

    // --- Literal text in props that render to the user or to AT -------------
    for (const m of raw.matchAll(TEXT_PROPS)) {
      if (!WORDS.test(m[2])) continue;
      add(file, n, 'hardcoded-prop',
        `${m[1]}="${m[2].slice(0, 36)}" is literal — assistive-technology strings are localised too (D7 §19.2)`);
    }

    // --- Concatenated numbers, currency, dates ------------------------------
    if (/\$\{[^}]*\}\s*(kWh|%|°C|kg|Rp|IDR)/.test(raw) || /(Rp|IDR)\s*\$\{/.test(raw))
      add(file, n, 'concatenated-format',
        `numbers, currency and units come from the locale, never string concatenation — Indonesian renders "Rp 1.444,70" with separators inverted (D7 §6.5)`);

    // --- Fixed widths sized to an English label -----------------------------
    if (/\b(width|inline-size|max-width|min-width)\s*:\s*\d+(px|ch)\b/.test(raw))
      add(file, n, 'sized-to-english',
        `a fixed text width — Indonesian runs 20–30 % longer ("Needs cleaning" → "Perlu dibersihkan"). Never size a control to its English label (D7 §19.2)`);

    // --- Physical directions break the RTL path -----------------------------
    if (/\b(margin|padding)-(left|right)\s*:/.test(raw) || /\b(left|right)\s*:\s*(?!auto)/.test(raw) === false) {
      if (/\b(margin|padding)-(left|right)\s*:/.test(raw))
        add(file, n, 'physical-direction',
          `use logical properties (inline-start / inline-end) so a right-to-left locale is a dir attribute, not a rewrite (D7 §19.2)`);
    }
  });
}

if (problems.length) {
  console.error(`\n  ✗ i18n — ${problems.length} violation(s)\n`);
  for (const p of problems.slice(0, 40)) console.error(`      ${p.file}:${p.line}  [${p.rule}] ${p.msg}`);
  if (problems.length > 40) console.error(`      … and ${problems.length - 40} more`);
  console.error('');
  process.exit(1);
}
console.log(`  ✓ i18n — ${files.length} file(s): no user-facing string is hardcoded`);
