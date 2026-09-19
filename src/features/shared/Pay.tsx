/**
 * shared.pay — labelled Phase 1A payment hand-off.
 *
 * @requirement FR-50 FR-51
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import type { AccountStanding } from '../../lib/simulation/index.ts';
import styles from './JourneyPanel.module.css';

const METHODS = ['card', 'virtualAccount', 'ewallet'] as const;

export default function Pay({ standing }: { standing: AccountStanding }) {
  const { t, i18n } = useTranslation();
  const [method, setMethod] = useState(null as (typeof METHODS)[number] | null);
  const [submitted, setSubmitted] = useState(false);
  const amount =
    standing.balanceIdr.value === null
      ? t('loadState.noData')
      : new Intl.NumberFormat(i18n.language, {
          style: 'currency',
          currency: 'IDR',
          maximumFractionDigits: 0,
        }).format(standing.balanceIdr.value);
  let action = <p className={styles.meta}>{t('shared.pay.choose')}</p>;
  if (method) {
    action = (
      <Button variant="primary" onClick={() => setSubmitted(true)}>
        {t('shared.pay.confirm')}
      </Button>
    );
  }
  if (submitted) {
    action = (
      <section className={styles.confirmation} role="status">
        <p>{t('shared.pay.submitted')}</p>
        <p>{t('shared.pay.pending')}</p>
        <Button variant="primary" to="/account">
          {t('shared.pay.return')}
        </Button>
      </section>
    );
  }

  return (
    <div className={styles.root}>
      <Button variant="ghost" to="/account">
        {t('shared.pay.back')}
      </Button>
      <header className={styles.intro}>
        <h1>{t('shared.pay.title')}</h1>
        <p>{t('shared.pay.purpose')}</p>
      </header>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t('shared.pay.amount')}</h2>
        <p>{amount}</p>
        <ProvenanceChip provenance={standing.balanceIdr.provenance} />
      </section>
      <MockBoundary explanationKey="shared.pay.mock">
        <fieldset className={styles.fieldset}>
          <legend>{t('shared.pay.method')}</legend>
          <div className={styles.choices}>
            {METHODS.map((value) => (
              <Button
                key={value}
                variant={method === value ? 'primary' : 'secondary'}
                pressed={method === value}
                onClick={() => setMethod(value)}
              >
                {t(`shared.pay.methodValue.${value}`)}
              </Button>
            ))}
          </div>
        </fieldset>
      </MockBoundary>
      {action}
    </div>
  );
}
