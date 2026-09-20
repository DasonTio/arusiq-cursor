#!/usr/bin/env node
/**
 * verify-links.mjs — INV-NO-DEAD-END, executed.
 *
 * "No screen is a dead end" is the one invariant a reader cannot check by
 * looking at a screenshot, because a button that goes nowhere looks exactly
 * like a button that works. It is also the invariant most likely to rot: a
 * route gets renamed in `catalog.ts` and the six call sites that named it as a
 * string carry on compiling.
 *
 * That is not hypothetical here. `restrictions.ts` emitted
 * `/approve?request=…` for the review action on every restriction notice while
 * the route has always been `/accounts/approve`, so the whole approval ladder
 * was reachable from the nav and unreachable from the notice that asked for
 * it. Nothing failed. TypeScript cannot type-check a string against a router,
 * so this does.
 *
 * Two rules:
 *
 * - `route-not-found` — a literal destination that `catalog.ts` does not
 *   declare. Query strings and hashes are stripped first; an interpolated
 *   segment is skipped, because its shape is not knowable statically.
 * - `href-outside-links` — the data layer building a path by hand instead of
 *   calling `links.ts`. The first rule catches the broken link; this one
 *   catches the habit that produces it, which is why `links.ts` exists.
 */
import { readFileSync, globSync } from 'node:fs';

const SRC = process.env.VERIFY_ROOT ?? 'src';
/** Always the real router, even when scanning a fixture tree. */
const CATALOG = 'src/routes/catalog.ts';

const routes = new Set(
  [...readFileSync(CATALOG, 'utf8').matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]),
);

// Product destinations only. A test that renders `<Button to="/unit/1">` to
// check it emits an anchor is asserting the primitive, not shipping a link.
const files = globSync(`${SRC}/**/*.{ts,tsx}`).filter((f) => !/\.test\.tsx?$/.test(f));
const problems = [];
const add = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

/** `to="/x"`, `to={'/x'}`, `to={`/x`}`, `href: '/x'`, `href: `/x`` */
const DESTINATION = [
  /\bto="(\/[^"]*)"/g,
  /\bto=\{'(\/[^']*)'\}/g,
  /\bto=\{`(\/[^`]*)`\}/g,
  /\bhref:\s*'(\/[^']*)'/g,
  /\bhref:\s*`(\/[^`]*)`/g,
];

const EXEMPT = /(^|\s)\/[/*]\s*route-exempt/;

/** Strip the query and hash; what remains is what the router matches. */
const pathOf = (raw) => raw.split(/[?#]/)[0].replace(/\/$/, '') || '/';

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  // `links.ts` is the one file allowed to spell a route out; that is its job.
  const isLinkBuilder = file.replace(/\\/g, '/').endsWith('lib/simulation/links.ts');
  const isDataLayer = /\/lib\//.test(file.replace(/\\/g, '/'));

  lines.forEach((raw, i) => {
    const n = i + 1;
    if (EXEMPT.test(raw)) return;
    const line = raw.split(/\/\/|\/\*/)[0];

    for (const re of DESTINATION) {
      for (const m of line.matchAll(re)) {
        const destination = m[1];
        const path = pathOf(destination);

        if (isDataLayer && !isLinkBuilder && /\bhref:/.test(line))
          add(
            file,
            n,
            'href-outside-links',
            `the adapter builds "${destination}" by hand — add it to links.ts, ` +
              `which is the file that keeps paths and catalog.ts in step`,
          );

        // An interpolated segment (`/spaces/${id}`) has no static shape. A
        // query parameter does not affect matching and was stripped above.
        if (path.includes('${')) continue;
        if (isLinkBuilder) continue;
        if (!routes.has(path))
          add(
            file,
            n,
            'route-not-found',
            `"${destination}" resolves to no route — catalog.ts declares no "${path}"`,
          );
      }
    }
  });
}

if (problems.length) {
  const byRule = {};
  for (const p of problems) (byRule[p.rule] ??= []).push(p);
  console.error(
    `\n  ✗ links — ${problems.length} violation(s) in ${new Set(problems.map((p) => p.file)).size} file(s)\n`,
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
console.log(
  `  ✓ links — ${files.length} file(s): every destination resolves to a declared route`,
);
