#!/usr/bin/env node
/**
 * verify.mjs — the single gate. One command an agent can run and read.
 *
 * Ordering is deliberate: the cheapest, most deterministic checks run first so
 * an agent gets the shortest possible correction loop. Contrast runs before
 * anything that depends on tokens; traceability runs last because it reports
 * progress rather than blocking.
 */
import { spawnSync } from 'node:child_process';

const steps = [
  // Runs first: it validates the verifiers themselves, so a green run below
  // means something.
  ['self-test', ['node', 'tools/verify-self-test.mjs']],
  // Formatting runs BEFORE the text-scanning gates on purpose. Prettier
  // rewraps JSX, and `verify-i18n`'s exemption is positional — it reads the
  // line a marker sits on and the one after. A reformat can therefore move an
  // exempted expression out from under its own `i18n-exempt` comment, which is
  // exactly how this drifted into 86 unformatted files: the check existed as
  // `npm run format:check` and was never part of the gate, so nobody ran it.
  ['format', ['npx', 'prettier', '--check', '.']],
  ['contrast', ['node', 'tools/verify-contrast.mjs']],
  ['tokens', ['node', 'tools/verify-tokens.mjs']],
  ['provenance', ['node', 'tools/verify-provenance.mjs']],
  ['i18n', ['node', 'tools/verify-i18n.mjs']],
  ['types', ['npx', 'tsc', '--noEmit', '-p', 'tsconfig.app.json']],
  ['lint', ['npx', 'eslint', '.']],
  ['test', ['npx', 'vitest', 'run', '--silent']],
  ['traceability', ['node', 'tools/verify-traceability.mjs']],
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const failed = [];

for (const [name, cmd] of steps) {
  if (only.length && !only.includes(name)) continue;
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
  if (r.status !== 0 && name !== 'traceability') failed.push(name);
}

if (failed.length) {
  console.error(`\n  ✗ verify failed: ${failed.join(', ')}`);
  console.error(
    `    Fix these before handing the branch to another agent or opening a PR.\n`,
  );
  process.exit(1);
}
console.log('  ✓ verify — all gates pass\n');
