#!/usr/bin/env node
/**
 * export-figma-tokens.mjs — tokens.css → Figma Variables.
 *
 * DIRECTION MATTERS, AND IT IS CODE → FIGMA.
 *
 * The obvious instinct is to design in Figma and export to code. Do not. The
 * code side already holds work Figma cannot reproduce: a contrast matrix
 * measured against every legal surface, four ADRs adjudicating real conflicts
 * between D5/D6/D7/D8, and the finding that D7 §4.1's own severity fills miss
 * D7 §19.1's 3:1 bar. Re-deriving the palette in Figma throws that away and
 * recreates D8 finding F-06 — "three artefacts would have shipped in two
 * identities" — by hand.
 *
 * So Figma inherits the verified values, and the RULES TRAVEL WITH THEM: the
 * `$description` on each variable carries the measured ratio and the constraint,
 * so a designer picking `severity/warning/mark` reads "3.98:1 · shape: triangle"
 * at the point of use rather than in a PDF they will not open.
 *
 * Output is W3C Design Tokens (DTCG) format — portable into Tokens Studio,
 * Figma Variables import plugins, and the figma-generate-library skill.
 *
 * Usage:  npm run figma:tokens   →  design/figma-tokens.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const css = readFileSync('src/design-system/tokens.css', 'utf8');

/** Pull `--name: value; /* comment *\/` triples, keeping the comment. */
const decls = [
  ...css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);(?:\s*\/\*+\s*(.*?)\s*\*+\/)?/gm),
].map(([, name, value, comment]) => ({
  name: name.replace(/^--/, ''),
  value: value.trim(),
  description: (comment ?? '').replace(/\s+/g, ' ').trim(),
}));

const byName = Object.fromEntries(decls.map((d) => [d.name, d.value]));

/** Resolve one level of var() indirection so Figma gets concrete values. */
const resolve = (v) => {
  const m = v.match(/^var\(--([\w-]+)\)$/);
  return m && byName[m[1]] ? resolve(byName[m[1]]) : v;
};

const set = (tree, path, node) => {
  let cur = tree;
  for (const k of path.slice(0, -1)) cur = cur[k] ??= {};
  cur[path.at(-1)] = node;
};

const tokens = {};
let counted = 0;

for (const { name, value, description } of decls) {
  const v = resolve(value);
  let path = null;
  let type = null;

  if (name.startsWith('color-')) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) continue; // skip aliases to other tokens
    type = 'color';
    const rest = name.slice('color-'.length);
    // brand-primary-deep → brand/primary-deep ; severity-critical-mark → severity/critical/mark
    // Figma renders `/` as a group, so nest deliberately: a designer opening
    // the picker should see severity → critical → mark, not one flat list.
    let m;
    if ((m = rest.match(/^severity-(critical|warning|normal|unknown)-(mark|text)$/)))
      path = ['color', 'severity', m[1], m[2]];
    else if ((m = rest.match(/^state-(\w+?)(-text)?$/)))
      path = ['color', 'state', m[1], m[2] ? 'text' : 'fill'];
    else if ((m = rest.match(/^(black|gray|white)-(\d+)$/)))
      path = ['color', 'neutral', `${m[1]}-${m[2]}`];
    else if ((m = rest.match(/^brand-(.+)$/))) path = ['color', 'brand', m[1]];
    // ADR-0005 — the hero surface tokens. Grouped together so it is obvious in
    // Figma that they belong to one scoped surface, not to a dark theme.
    else if (/^(on-inverse|border-on-inverse|eco-on-inverse)/.test(rest))
      path = ['color', 'inverse', rest.replace(/-?on-inverse-?/, '') || 'default'];
    else path = ['color', rest];
  } else if (name.startsWith('space-')) {
    type = 'dimension';
    path = ['spacing', name.slice('space-'.length)];
  } else if (name.startsWith('radius-')) {
    type = 'dimension';
    path = ['radius', name.slice('radius-'.length)];
  } else if (name.startsWith('font-size-')) {
    type = 'dimension';
    path = ['typography', 'size', name.slice('font-size-'.length)];
  } else if (name.startsWith('line-height-')) {
    type = 'number';
    path = ['typography', 'lineHeight', name.slice('line-height-'.length)];
  } else if (name.startsWith('font-weight-')) {
    type = 'fontWeight';
    path = ['typography', 'weight', name.slice('font-weight-'.length)];
  } else if (name === 'font-heading' || name === 'font-body') {
    type = 'fontFamily';
    path = ['typography', 'family', name.slice('font-'.length)];
  } else if (name.startsWith('duration-')) {
    type = 'duration';
    path = ['motion', 'duration', name.slice('duration-'.length)];
  } else if (name.startsWith('shadow-')) {
    type = 'shadow';
    path = ['elevation', name.slice('shadow-'.length)];
  } else if (name.startsWith('surface-')) {
    type = 'color';
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) continue;
    path = ['surface', name.slice('surface-'.length)];
  } else if (
    name.startsWith('grid-') ||
    name === 'content-max' ||
    name === 'target-min'
  ) {
    type = 'dimension';
    path = ['layout', name];
  }

  if (!path) continue;
  set(tokens, path, {
    $type: type,
    $value: type === 'number' || type === 'fontWeight' ? Number(v) || v : v,
    ...(description ? { $description: description } : {}),
  });
  counted++;
}

/* --- Constraints Figma cannot infer from a value ------------------------- */
tokens.$description =
  'Generated from src/design-system/tokens.css by tools/export-figma-tokens.mjs. ' +
  'DO NOT EDIT IN FIGMA — edit the CSS and re-export, or the two drift and you ' +
  'recreate D8 finding F-06. Changing a token requires an ADR.';

tokens.color.neutral.$description =
  'Every neutral has ONE role. gray-3 is a CONTROL BORDER, not text — at 4.00:1 ' +
  'it is below the 4.5:1 text bar, so placeholders use gray-2 (ADR-0002). ' +
  'gray-4 and gray-5 are decorative; an input outlined in either is an ' +
  'accessibility failure.';

tokens.color.severity.$description =
  'Severity is a SEPARATE family from state (ADR-0002). Every use carries mark + ' +
  'shape + label — circle / triangle / square / dashed ring. A bare coloured dot ' +
  'is not acceptable anywhere, including charts. There is NO solid-filled severity ' +
  'badge: no foreground clears 4.5:1 across all four marks. Use a 10% tint with the ' +
  '-text foreground and a hairline border in the mark colour.';

tokens.color.state.$description =
  'Form and interface feedback ONLY — never severity. Fills never carry text; ' +
  'where a state colour becomes type use its -text variant. Eco is the ' +
  'sustainability channel and never indicates severity.';

tokens.spacing.$description =
  'The only legal gaps. 48, 64 and 88 are deliberately ABSENT so the scale stays ' +
  'coarse enough to decide quickly. Textfield and Expressive Button padding is ' +
  'derived from font size in em and may fall outside this scale — that is the one ' +
  'exemption, and it is not a licence for arbitrary spacing.';

mkdirSync('design', { recursive: true });
writeFileSync('design/figma-tokens.json', JSON.stringify(tokens, null, 2) + '\n');

console.log(`
  ✓ design/figma-tokens.json — ${counted} variables, DTCG format

    Import into Figma with a Variables import plugin (Tokens Studio, or
    "Design Tokens" / "Variables Import"), or hand this file to the
    figma-generate-library skill.

    Re-run after ANY token change. tokens.css is the source of truth;
    Figma is a consumer. Never the other way round.
`);
