/**
 * ARUSIQ project ESLint rules.
 *
 * These duplicate three checks from `tools/` on purpose. The `.mjs` verifiers
 * are the CI gate; these are the INNER loop — Cursor and Claude Code both read
 * inline diagnostics as they type, so a violation is corrected in the same pass
 * rather than after a separate command nobody remembered to run.
 *
 * Ported only where an AST genuinely beats a regex. CSS-file scanning stays in
 * tools/verify-tokens.mjs; ESLint does not lint CSS.
 */

/** Components that render a measured figure (D6 NFR Data integrity). */
const METRIC_COMPONENTS = new Set([
  'Metric', 'KpiTile', 'MetricValue', 'ChartCard', 'SavingsChart', 'CarbonCard',
]);

/** Props whose string value reaches a user or assistive technology. */
const TEXT_PROPS = new Set([
  'placeholder', 'aria-label', 'title', 'alt', 'aria-description', 'aria-placeholder',
]);

const hasExemption = (context, node, marker) => {
  const sc = context.sourceCode;
  const line = node.loc.start.line;
  return sc.getAllComments().some((c) => {
    const t = c.value;
    return t.includes(marker) &&
      (c.loc.end.line === line || c.loc.end.line === line - 1 || c.loc.start.line === line);
  });
};

const requireProvenanceProp = {
  meta: {
    type: 'problem',
    docs: { description: 'Every figure declares Simulated | Estimated | Provisional | Verified' },
    schema: [],
    messages: {
      missing:
        "<{{name}}> has no `provenance` prop. D6 requires 100 % of figures labelled, beside the figure itself (D7 §11). An aggregate inherits the weakest provenance of its inputs.",
      nullish:
        "<{{name}}> has a nullish `provenance`. A figure with unknown origin is exactly what the label exists to prevent.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const name = node.name.name;
        if (!METRIC_COMPONENTS.has(name)) return;
        if (hasExemption(context, node, 'provenance-exempt')) return;

        const attr = node.attributes.find(
          (a) => a.type === 'JSXAttribute' && a.name.name === 'provenance',
        );
        // A spread may supply it; do not second-guess that.
        const hasSpread = node.attributes.some((a) => a.type === 'JSXSpreadAttribute');
        if (!attr) {
          if (!hasSpread) context.report({ node, messageId: 'missing', data: { name } });
          return;
        }
        // `null` parses as a Literal; `undefined` parses as an Identifier.
        // Checking only for Literal misses half the cases.
        const v = attr.value;
        if (v?.type === 'JSXExpressionContainer') {
          const e = v.expression;
          const isNullish =
            (e.type === 'Literal' && e.value === null) ||
            (e.type === 'Identifier' && e.name === 'undefined');
          if (isNullish) context.report({ node: attr, messageId: 'nullish', data: { name } });
        }
      },
    };
  },
};

const noHardcodedJsxText = {
  meta: {
    type: 'problem',
    docs: { description: 'No user-facing string is hardcoded (D5 UR-LANG-01)' },
    schema: [],
    messages: {
      text: 'Literal UI text "{{text}}" — route it through t(\'key\') so a locale pack replaces it without a code change (D5 UR-LANG-01).',
      prop: 'Literal {{prop}}="{{text}}" — assistive-technology strings are localised too (D7 §19.2).',
    },
  },
  create(context) {
    const WORDS = /\p{L}{2,}/u;
    return {
      // An AST visitor sees the text node regardless of how Prettier wrapped it,
      // which a line-based regex cannot.
      JSXText(node) {
        const text = node.value.trim();
        if (!text || !WORDS.test(text)) return;
        if (hasExemption(context, node, 'i18n-exempt')) return;
        context.report({
          node, messageId: 'text',
          data: { text: text.replace(/\s+/g, ' ').slice(0, 44) },
        });
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const prop = node.name.name;
        if (!TEXT_PROPS.has(prop)) return;
        if (node.value?.type !== 'Literal' || typeof node.value.value !== 'string') return;
        if (!WORDS.test(node.value.value)) return;
        if (hasExemption(context, node, 'i18n-exempt')) return;
        context.report({
          node, messageId: 'prop',
          data: { prop, text: node.value.value.slice(0, 36) },
        });
      },
    };
  },
};

const noRawValueInStyleProp = {
  meta: {
    type: 'problem',
    docs: { description: 'Inline styles use design tokens, never raw values' },
    schema: [],
    messages: {
      color: 'Raw colour "{{value}}" in a style prop — use var(--color-…) from tokens.css.',
      length: 'Raw length "{{value}}" in a style prop — use var(--space-N) (4·8·16·24·32·40·56·72·80·96·120) or a radius/target token.',
      zIndex: 'Raw z-index "{{value}}" — use var(--z-base|sticky|dropdown|overlay|modal|toast). The number that beat everything else is the number the next person has to beat (D7 §10.4).',
    },
  },
  create(context) {
    const COLOR = /#[0-9A-Fa-f]{3,8}\b|\b(?:rgba?|hsla?)\(/;
    const LENGTH = /(?<![\w-])(\d+(?:\.\d+)?)px/;
    const check = (node, key, raw) => {
      if (typeof raw !== 'string') return;
      if (raw.includes('var(--')) return;
      if (key === 'zIndex') { context.report({ node, messageId: 'zIndex', data: { value: raw } }); return; }
      const c = raw.match(COLOR);
      if (c) { context.report({ node, messageId: 'color', data: { value: c[0] } }); return; }
      const m = raw.match(LENGTH);
      if (m && Number(m[1]) !== 0 && Number(m[1]) !== 1)
        context.report({ node, messageId: 'length', data: { value: m[0] } });
    };
    return {
      JSXAttribute(node) {
        if (node.name.name !== 'style') return;
        if (node.value?.type !== 'JSXExpressionContainer') return;
        const expr = node.value.expression;
        if (expr.type !== 'ObjectExpression') return;
        for (const p of expr.properties) {
          if (p.type !== 'Property') continue;
          const key = p.key.name ?? p.key.value;
          if (p.value.type === 'Literal') check(p.value, key, String(p.value.value));
          if (p.value.type === 'Literal' && typeof p.value.value === 'number' && key === 'zIndex')
            check(p.value, 'zIndex', String(p.value.value));
        }
      },
    };
  },
};

export default {
  meta: { name: 'arusiq', version: '1.0.0' },
  rules: {
    'require-provenance-prop': requireProvenanceProp,
    'no-hardcoded-jsx-text': noHardcodedJsxText,
    'no-raw-value-in-style-prop': noRawValueInStyleProp,
  },
};
