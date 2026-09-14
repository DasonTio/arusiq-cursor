#!/usr/bin/env node
/**
 * verify-traceability.mjs — D5 §6 / D6 §14, executed.
 *
 * Every document in this set traces requirements to each other, and D8 found
 * that 21 functional requirements cited by the traceability tables did not
 * exist at all: "a developer following traceability landed on nothing."
 *
 * This closes the last link — requirement to CODE — and makes sprint progress a
 * number rather than a feeling. It reports rather than fails by default,
 * because unbuilt requirements are the normal state mid-sprint; pass --strict
 * in the release gate.
 */
import { readFileSync, globSync } from 'node:fs';

const spec = JSON.parse(readFileSync('context/requirements/requirements.json', 'utf8'));
const strict = process.argv.includes('--strict');

const known = new Set(spec.requirements.map((r) => r.id));
const claimed = new Map(); // FR id -> [files]
const unknown = [];

for (const file of globSync('src/**/*.{ts,tsx}')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(
    /@requirement\s+([A-Z]{2}-[\w-]+(?:\s+[A-Z]{2}-[\w-]+)*)/g,
  )) {
    for (const id of m[1].split(/\s+/)) {
      if (!known.has(id)) {
        unknown.push({ file, id });
        continue;
      }
      if (!claimed.has(id)) claimed.set(id, []);
      claimed.get(id).push(file);
    }
  }
}

const must = spec.requirements.filter((r) => r.priority === 'Must');
const should = spec.requirements.filter((r) => r.priority === 'Should');
const pct = (a, b) => (b === 0 ? 100 : Math.round((a / b) * 100));
const doneMust = must.filter((r) => claimed.has(r.id));
const doneShould = should.filter((r) => claimed.has(r.id));

console.log(`\n  Phase 1A traceability — requirement → code`);
console.log('  ' + '─'.repeat(70));
console.log(
  `  Must    ${String(doneMust.length).padStart(2)} / ${must.length}  (${pct(doneMust.length, must.length)}%)`,
);
console.log(
  `  Should  ${String(doneShould.length).padStart(2)} / ${should.length}  (${pct(doneShould.length, should.length)}%)`,
);

const openMust = must.filter((r) => !claimed.has(r.id));
if (openMust.length) {
  console.log(`\n  Not yet claimed by any file (Must):`);
  for (const r of openMust) console.log(`      ${r.id}  ${r.statement.slice(0, 88)}`);
}

if (unknown.length) {
  console.error(
    `\n  ✗ ${unknown.length} @requirement tag(s) reference an ID that does not exist:`,
  );
  for (const u of unknown) console.error(`      ${u.file}  ${u.id}`);
  console.error(
    `\n  This is exactly the D8 finding F-04 failure mode: traceability pointing at nothing.`,
  );
  process.exit(1);
}

const open = spec.openDecisions.filter((d) => d.status === 'open');
if (open.length) {
  console.log(
    `\n  ⚠ ${open.length} open decision(s) blocking requirements — cheap now, expensive to retrofit:`,
  );
  for (const d of open)
    console.log(`      ${d.id}  ${d.question}  → blocks ${d.blocks.join(', ')}`);
}

if (strict && openMust.length) {
  console.error(`\n  ✗ --strict: ${openMust.length} Must requirement(s) unbuilt\n`);
  process.exit(1);
}
console.log('');
