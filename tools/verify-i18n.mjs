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
import { readFileSync, globSync, existsSync } from 'node:fs';

const ROOT = process.env.VERIFY_ROOT ?? 'src';
const files = globSync(`${ROOT}/**/*.tsx`);
const problems = [];
const add = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

const TEXT_PROPS =
  /\b(placeholder|aria-label|title|alt|label|aria-description)\s*=\s*"([^"]{2,})"/g;
const WORDS = /[A-Za-z]{2,}/;
/** Tolerated: pure markup, entities, numbers, single letters, code-ish tokens. */
const IGNORE = /^[\s\d\p{P}\p{S}]*$/u;

/**
 * Blank out `//` and `/* *\/` comments, preserving every newline so reported
 * line numbers still point at the real line.
 *
 * The JSX text scan below reads the whole file at once, which is what lets it
 * catch Prettier-wrapped text. The cost is that a comment sitting BETWEEN two
 * JSX elements — e.g. between the entries of a `Record<string, ReactNode>` —
 * looks exactly like a text node to it. A comment is never user-facing text, so
 * it is removed before the scan rather than tolerated by a growing IGNORE list.
 * String-aware, so a `//` inside a URL is not mistaken for a comment.
 */
/** True when every `(` is closed and none closes before it opened. */
function isBalanced(text) {
  let depth = 0;
  for (const c of text) {
    if (c === '(') depth += 1;
    else if (c === ')' && (depth -= 1) < 0) return false;
  }
  return depth === 0;
}

function stripComments(src) {
  let out = '';
  let i = 0;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, Math.min(j + 1, src.length));
      i = j + 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((raw, i) => {
    const n = i + 1;
    // Exemption applies to the line it sits on or the line it precedes,
    // matching the eslint-disable-next-line convention agents already know.
    const exempt = /i18n-exempt/;
    if (exempt.test(raw) || (i > 0 && exempt.test(lines[i - 1]))) return;

    // --- Literal text in props that render to the user or to AT -------------
    for (const m of raw.matchAll(TEXT_PROPS)) {
      if (!WORDS.test(m[2])) continue;
      add(
        file,
        n,
        'hardcoded-prop',
        `${m[1]}="${m[2].slice(0, 36)}" is literal — assistive-technology strings are localised too (D7 §19.2)`,
      );
    }

    // --- Concatenated numbers, currency, dates ------------------------------
    if (/\$\{[^}]*\}\s*(kWh|%|°C|kg|Rp|IDR)/.test(raw) || /(Rp|IDR)\s*\$\{/.test(raw))
      add(
        file,
        n,
        'concatenated-format',
        `numbers, currency and units come from the locale, never string concatenation — Indonesian renders "Rp 1.444,70" with separators inverted (D7 §6.5)`,
      );

    // --- Fixed widths sized to an English label -----------------------------
    // Matches both CSS (`width: 120px`) and JSX (`width: '120px'`).
    if (
      /\b(width|inlineSize|inline-size|maxWidth|max-width|minWidth|min-width)\s*:\s*['"]?\d+(px|ch)\b/.test(
        raw,
      )
    )
      add(
        file,
        n,
        'sized-to-english',
        `a fixed text width — Indonesian runs 20–30 % longer ("Needs cleaning" → "Perlu dibersihkan"). Never size a control to its English label (D7 §19.2)`,
      );

    // --- Physical directions break the RTL path -----------------------------
    // CSS kebab-case and JSX camelCase are both real; only checking one meant
    // every React inline style slipped through.
    if (
      /\b(margin|padding)-(left|right)\s*:/.test(raw) ||
      /\b(margin|padding)(Left|Right)\s*:/.test(raw)
    )
      add(
        file,
        n,
        'physical-direction',
        `use logical properties (inline-start / inline-end) so a right-to-left locale is a dir attribute, not a rewrite (D7 §19.2)`,
      );
  });

  // --- Literal text between JSX tags -----------------------------------------
  // Scanned across the WHOLE FILE, not line by line. Prettier formats JSX as
  //   <Button>
  //     Save changes
  //   </Button>
  // so a per-line scan requiring `>` and `<` on one line misses the single most
  // common formatting in React — a hole exactly where agents write most text.
  // The character class excludes < > { } so a match cannot span a tag or an
  // expression; it is strictly the text node between two elements.
  const scanned = stripComments(src);
  for (const m of scanned.matchAll(/>([^<>{}]{2,}?)</gs)) {
    const text = m[1].trim();
    if (IGNORE.test(text) || !WORDS.test(text)) continue;
    // Not every `>` closes a tag and not every `<` opens one. An arrow
    // function whose body starts on the next line with a comparison —
    //   const xOf = (i) =>
    //     domain.length <= 1 ? … : …
    // looks exactly like a text node to a regex, and reporting it teaches the
    // next agent that this rule cries wolf. JSX never closes a tag with `=>`,
    // and a tag never opens with `<=`: the name, `/`, `!` or `>` follows the
    // bracket immediately. Both checks are shape, not vocabulary, so nothing
    // that is really user-facing text escapes through them.
    if (scanned[m.index - 1] === '=') continue;
    if (!/[A-Za-z/!>]/.test(scanned[m.index + m[0].length] ?? '')) continue;
    // Two sibling JSX EXPRESSIONS — `<A />` then `foo: (<B />)`, or a second
    // `render(<C />)` in a test — leave ordinary code in the span, and code is
    // not a text node. Prose has balanced parentheses ("Needs cleaning (soon)"
    // is still caught); a slice of code between two elements almost never does.
    if (!isBalanced(text)) continue;
    const n = src.slice(0, m.index).split('\n').length;
    const here = lines[n - 1] ?? '';
    const before = lines[n - 2] ?? '';
    if (/i18n-exempt/.test(here) || /i18n-exempt/.test(before)) continue;
    add(
      file,
      n,
      'hardcoded-text',
      `literal UI text "${text.replace(/\s+/g, ' ').slice(0, 44)}" — route it through t('key') so a locale pack can replace it (D5 UR-LANG-01)`,
    );
  }
}

// --- Locale parity · D5 UR-LANG-01 -----------------------------------------
// "Any further language as a locale pack WITHOUT a code change" only holds if
// every pack carries the same keys. Locale files are append-only across agents
// (context/40-architecture.md), which makes divergence the likeliest drift in
// the project: one agent adds a key to en.json and forgets id.json, and the
// Indonesian build silently renders a raw key path to a stakeholder.
const LOCALES = 'src/lib/i18n/locales';
if (existsSync(LOCALES)) {
  const flat = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`],
    );
  const packs = globSync(`${LOCALES}/*.json`).map((f) => ({
    name: f.split('/').pop(),
    keys: new Set(flat(JSON.parse(readFileSync(f, 'utf8')))),
  }));
  const base = packs.find((p) => p.name === 'en.json') ?? packs[0];
  for (const pack of packs) {
    if (pack === base) continue;
    for (const k of base.keys)
      if (!pack.keys.has(k))
        add(
          `${LOCALES}/${pack.name}`,
          0,
          'locale-parity',
          `missing key "${k}" present in ${base.name} — the Indonesian build would render the raw key path`,
        );
    for (const k of pack.keys)
      if (!base.keys.has(k))
        add(
          `${LOCALES}/${base.name}`,
          0,
          'locale-parity',
          `missing key "${k}" present in ${pack.name}`,
        );
  }
}

if (problems.length) {
  console.error(`\n  ✗ i18n — ${problems.length} violation(s)\n`);
  for (const p of problems.slice(0, 40))
    console.error(`      ${p.file}:${p.line}  [${p.rule}] ${p.msg}`);
  if (problems.length > 40) console.error(`      … and ${problems.length - 40} more`);
  console.error('');
  process.exit(1);
}
console.log(`  ✓ i18n — ${files.length} file(s): no user-facing string is hardcoded`);
