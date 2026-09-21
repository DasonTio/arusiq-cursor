// The conformant form of the same component. Every verifier must stay silent.
// i18n-exempt
const BRAND = 'ARUSIQ';

// A map of JSX values. The comment and the object key sitting BETWEEN two
// elements are code, not text nodes — the hardcoded-text scan reads the file
// whole, so it has to tell the two apart. It must stay silent here while still
// catching the literal "Save changes" in the violating fixture.
export const GLYPHS = {
  one: (
    <svg>
      <circle cx="1" cy="1" r="1" />
    </svg>
  ),
  // a comment between two entries is never user-facing text
  two: (
    <svg>
      <rect x="1" y="1" width="2" height="2" />
    </svg>
  ),
};

export function Good({ t, total, provenance }) {
  return (
    <div style={{ color: 'var(--color-gray-1)', padding: 'var(--space-3)' }}>
      <span>{BRAND}</span>
      <p>{t('client.energy.saved')}</p>
      <button>{t('common.save')}</button>
      <input placeholder={t('form.email')} />
      <div style={{ marginInlineStart: 'var(--space-3)' }}>{total}</div>
      {/* A proportional bar computes its own CSS length. It is not a measured
          figure and no reader ever sees it, so neither the bare-figure rule
          nor the concatenated-format rule may fire on it — delete the
          CSS_DECL guard in either tool and this fixture stops being clean. */}
      <span
        className="bar"
        style={{ inlineSize: total > 0 ? `${(total / 100) * 100}%` : '0%' }}
      />
      <Metric value={5} unit="kWh" provenance={provenance} />
      <Button to="/accounts/approve?request=req-1">{t('common.review')}</Button>
    </div>
  );
}
