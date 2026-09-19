/**
 * Regression tests for the project ESLint rules.
 *
 * These rules are load-bearing: they are the inner loop that stops an agent
 * shipping an unlabelled figure or a hardcoded English string. The most likely
 * way they fail is someone "fixing" a false positive and silently gutting the
 * rule — so each rule asserts both that it FIRES on the violation and that it
 * stays QUIET on the correct form.
 */
import { RuleTester } from 'eslint';
import plugin from './index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run('require-provenance-prop', plugin.rules['require-provenance-prop'], {
  valid: [
    { code: `const a = <Metric value={1} provenance="simulated" />;` },
    { code: `const a = <KpiTile provenance={p} />;` },
    // A spread may legitimately supply it — do not second-guess that.
    { code: `const a = <Metric {...props} />;` },
    // Not a metric component.
    { code: `const a = <Card value={1} />;` },
    { code: `// provenance-exempt\nconst a = <Metric value={1} />;` },
  ],
  invalid: [
    { code: `const a = <Metric value={1} />;`, errors: [{ messageId: 'missing' }] },
    { code: `const a = <ChartCard data={d} />;`, errors: [{ messageId: 'missing' }] },
    {
      code: `const a = <Metric provenance={undefined} />;`,
      errors: [{ messageId: 'nullish' }],
    },
    {
      code: `const a = <Metric provenance={null} />;`,
      errors: [{ messageId: 'nullish' }],
    },
  ],
});

ruleTester.run('no-hardcoded-jsx-text', plugin.rules['no-hardcoded-jsx-text'], {
  valid: [
    { code: `const a = <p>{t('client.overview.title')}</p>;` },
    { code: `const a = <p>{count}</p>;` },
    { code: `const a = <span>—</span>;` },
    { code: `const a = <input placeholder={t('form.email')} />;` },
    { code: `// i18n-exempt\nconst a = <h1>ARUSIQ</h1>;` },
  ],
  invalid: [
    { code: `const a = <p>Hello world</p>;`, errors: [{ messageId: 'text' }] },
    // The case a line-based regex misses entirely: Prettier-wrapped JSX.
    {
      code: `const a = (\n  <button>\n    Save changes\n  </button>\n);`,
      errors: [{ messageId: 'text' }],
    },
    {
      code: `const a = <input placeholder="Enter your email" />;`,
      errors: [{ messageId: 'prop' }],
    },
    {
      code: `const a = <img alt="A photo of the unit" />;`,
      errors: [{ messageId: 'prop' }],
    },
  ],
});

ruleTester.run(
  'require-selection-state-on-button',
  plugin.rules['require-selection-state-on-button'],
  {
    valid: [
      // Toggle semantics.
      {
        code: `const a = <Button variant={x === y ? 'primary' : 'ghost'} pressed={x === y} />;`,
      },
      // Current-within-a-set semantics.
      {
        code: `const a = <Button variant={view === item ? 'primary' : 'ghost'} current={view === item} to={href} />;`,
      },
      // A fixed variant is not a selection control — nothing to flag.
      { code: `const a = <Button variant="primary" onClick={fn} />;` },
      // Not a Button component.
      { code: `const a = <Chip variant={x ? 'primary' : 'ghost'} />;` },
      {
        code: `// selection-state-exempt\nconst a = <Button variant={x ? 'primary' : 'ghost'} />;`,
      },
    ],
    invalid: [
      {
        code: `const a = <Button variant={x === y ? 'primary' : 'ghost'} onClick={fn} />;`,
        errors: [{ messageId: 'missing' }],
      },
      {
        code: `const a = <Button variant={active ? 'primary' : 'secondary'} to={href} />;`,
        errors: [{ messageId: 'missing' }],
      },
    ],
  },
);

ruleTester.run(
  'no-raw-value-in-style-prop',
  plugin.rules['no-raw-value-in-style-prop'],
  {
    valid: [
      { code: `const a = <div style={{ color: 'var(--color-gray-1)' }} />;` },
      { code: `const a = <div style={{ padding: 'var(--space-3)' }} />;` },
      // 0 and 1px hairlines are allowed.
      { code: `const a = <div style={{ borderWidth: '1px' }} />;` },
      { code: `const a = <div style={{ margin: '0px' }} />;` },
    ],
    invalid: [
      {
        code: `const a = <div style={{ color: '#ff0000' }} />;`,
        errors: [{ messageId: 'color' }],
      },
      {
        code: `const a = <div style={{ background: 'rgba(0,0,0,.5)' }} />;`,
        errors: [{ messageId: 'color' }],
      },
      {
        code: `const a = <div style={{ padding: '13px' }} />;`,
        errors: [{ messageId: 'length' }],
      },
    ],
  },
);
