#!/usr/bin/env node
/**
 * new-screen.mjs — scaffold one Phase 1A screen from its requirements.
 *
 * This exists to make the boring parts unskippable. The four data states, the
 * @requirement tags and the namespaced locale keys are the three things an
 * agent under context pressure drops first, and all three are expensive to
 * retrofit. Generating them means the screen starts correct and the agent's
 * attention goes to the part that actually needs judgement: what belongs on the
 * screen at all.
 *
 * Usage:  npm run new:screen client.overview
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const spec = JSON.parse(readFileSync('context/requirements/requirements.json', 'utf8'));
const id = process.argv[2];

if (!id) {
  console.error('\n  usage: npm run new:screen <screen-id>\n\n  available:');
  for (const s of spec.screens) console.error(`      ${s.id}`);
  process.exit(1);
}

const screen = spec.screens.find((s) => s.id === id);
if (!screen) {
  console.error(`\n  ✗ unknown screen "${id}". Available:`);
  for (const s of spec.screens) console.error(`      ${s.id}`);
  process.exit(1);
}

const [area, name] = id.split('.');
const Pascal = name
  .split('-')
  .map((p) => p[0].toUpperCase() + p.slice(1))
  .join('');
// Screen ids use short prefixes; the owned feature directories use role names
// (context/40-architecture.md). Without this map, technician screens would land
// in src/features/tech/ — a directory no agent owns.
const AREA_DIR = { tech: 'technician' };
const dir = `src/features/${AREA_DIR[area] ?? area}`;
const file = `${dir}/${Pascal}.tsx`;

if (existsSync(file)) {
  console.error(`\n  ✗ ${file} already exists — refusing to overwrite.\n`);
  process.exit(1);
}

const reqs = screen.satisfies
  .map((rid) => spec.requirements.find((r) => r.id === rid))
  .filter(Boolean);
const reqComment = reqs.length
  ? reqs.map((r) => ` * - ${r.id} (${r.priority}): ${r.statement}`).join('\n')
  : ' * - nothing yet: the sitemap names this screen, but no functional\n *   requirement sits behind it. Keep it thin until one does.';

// An empty `@requirement` tag reads as a claim with nothing behind it, so the
// tag is omitted entirely when the screen satisfies no requirement.
const requirementTag = screen.satisfies.length
  ? ` *\n * @requirement ${screen.satisfies.join(' ')}\n`
  : '';

const body = `/**
 * ${screen.id} — ${screen.role.join(', ')}
 *
${screen.note ? ` * ${screen.note}\n *\n` : ''} * Satisfies:
${reqComment}
 *
 * TODO(agent): replace the placeholder body. Keep all four data states — they
 * are why this file was generated rather than written from scratch.
${requirementTag} */
import { useTranslation } from 'react-i18next';
import type { LoadState } from '../../lib/domain/loadState.ts';

export default function ${Pascal}() {
  const { t } = useTranslation();

  // D7 §18.3 — four treatments that are NOT interchangeable. Wire these to the
  // adapter in src/lib/simulation. Do not collapse noData into empty: that is
  // how a dashboard comes to imply a unit consumed nothing when it was offline.
  // The assertion is deliberate: without it TypeScript narrows the const to
  // the literal 'ready' and reports the four branches below as dead code.
  // Replace the whole line with the adapter call from src/lib/simulation.
  const state = 'ready' as LoadState;

  if (state === 'loading') {
    // Skeletons matching the final layout — never a spinner over a blank page.
    return <div aria-busy="true" aria-live="polite" />;
  }

  if (state === 'empty') {
    // Explain what would appear here, and offer the action that creates it.
    return <section>{t('${id}.empty')}</section>;
  }

  if (state === 'error') {
    // Say what failed, and offer a retry.
    return <section role="alert">{t('${id}.error')}</section>;
  }

  if (state === 'noData') {
    // Grey severity with a last-seen time. Never a zero, never an empty state.
    return <section>{t('loadState.noData')}</section>;
  }

  return (
    <section>
      <h1>{t('${id}.title')}</h1>
    </section>
  );
}
`;

mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, body);

// Locale keys, namespaced by screen, appended to BOTH packs. Parity is gated by
// verify-i18n.mjs, and a key added to one pack only is the likeliest drift in
// the project.
const KEYS = { title: `${Pascal}`, empty: 'Nothing here yet', error: 'Could not load' };
for (const [loc, prefix] of [
  ['en', ''],
  ['id', '[ID] '],
]) {
  const p = `src/lib/i18n/locales/${loc}.json`;
  const json = JSON.parse(readFileSync(p, 'utf8'));
  json[area] ??= {};
  json[area][name] ??= {};
  for (const [k, v] of Object.entries(KEYS)) json[area][name][k] ??= `${prefix}${v}`;
  writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

console.log(`
  ✓ ${file}
  ✓ locale keys under "${area}.${name}" in en.json and id.json
       Indonesian strings are stubbed "[ID] …" — translate before the demo;
       a raw stub in front of a stakeholder is worse than an English fallback.

  Next: read context/30-design-system.md, then replace the placeholder body.
        npm run verify
`);
