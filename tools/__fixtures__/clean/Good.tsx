// The conformant form of the same component. Every verifier must stay silent.
// i18n-exempt
const BRAND = 'ARUSIQ';

export function Good({ t, total, provenance }) {
  return (
    <div style={{ color: 'var(--color-gray-1)', padding: 'var(--space-3)' }}>
      <span>{BRAND}</span>
      <p>{t('client.energy.saved')}</p>
      <button>{t('common.save')}</button>
      <input placeholder={t('form.email')} />
      <div style={{ marginInlineStart: 'var(--space-3)' }}>{total}</div>
      <Metric value={5} unit="kWh" provenance={provenance} />
    </div>
  );
}
