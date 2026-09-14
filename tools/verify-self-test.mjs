#!/usr/bin/env node
/**
 * verify-self-test.mjs — tests the tests.
 *
 * The verifiers are the only thing standing between two dozen agent-built
 * screens and a demo full of unlabelled numbers. Their most likely failure mode
 * is not a crash: it is someone hitting a false positive, "fixing" the regex,
 * and silently gutting a rule that then never fires again.
 *
 * So each rule is asserted in both directions — it FIRES on the violating
 * fixture, and it stays QUIET on the clean one. A rule that cannot do both is
 * not a gate, it is a gate-shaped object.
 */
import { spawnSync } from 'node:child_process';

const run = (script, root) => {
  const r = spawnSync('node', [script], {
    env: { ...process.env, VERIFY_ROOT: root },
    encoding: 'utf8',
  });
  return { out: (r.stdout ?? '') + (r.stderr ?? ''), code: r.status };
};

const VIOLATING = 'tools/__fixtures__/violating';
const CLEAN = 'tools/__fixtures__/clean';

/** Each rule id must appear in the violating run's output. */
const EXPECTED = {
  'tools/verify-tokens.mjs': [
    'no-raw-color',
    'no-raw-px',
    'no-raw-z-index',
    'motion-budget',
    'motion-layout',
    'light-mode-only',
    'unknown-breakpoint',
  ],
  'tools/verify-provenance.mjs': [
    'metric-needs-provenance',
    'bare-figure',
    'forbidden-word-credit',
    'co2-separation',
  ],
  'tools/verify-i18n.mjs': [
    'hardcoded-text',
    'hardcoded-prop',
    'concatenated-format',
    'sized-to-english',
    'physical-direction',
  ],
};

const failures = [];
let checked = 0;

for (const [script, rules] of Object.entries(EXPECTED)) {
  const bad = run(script, VIOLATING);
  if (bad.code === 0)
    failures.push(`${script} PASSED the violating fixture — it is not gating anything`);
  for (const rule of rules) {
    checked++;
    if (!bad.out.includes(rule))
      failures.push(`${script} did not report [${rule}] on the violating fixture`);
  }

  const good = run(script, CLEAN);
  checked++;
  if (good.code !== 0)
    failures.push(
      `${script} FAILED the clean fixture — a false positive. A noisy gate gets ` +
        `disabled, which is worse than no gate.\n${good.out.split('\n').slice(0, 12).join('\n')}`,
    );
}

if (failures.length) {
  console.error(
    `\n  ✗ self-test — ${failures.length} problem(s) with the verifiers themselves\n`,
  );
  for (const f of failures) console.error(`      · ${f}`);
  console.error('');
  process.exit(1);
}
console.log(
  `  ✓ self-test — ${checked} assertions: every rule fires on the violating fixture and stays quiet on the clean one`,
);
