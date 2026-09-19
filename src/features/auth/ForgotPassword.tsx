/**
 * auth.forgot-password — mocked reset. Confirmation never reveals whether
 * the identifier exists.
 *
 * @requirement FR-03
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { Textfield } from '../../components/Textfield.tsx';
import { LanguageSwitch } from '../shared/LanguageSwitch.tsx';
import styles from './SignIn.module.css';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('email' as 'email' | 'whatsapp');
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <section className={styles.card}>
      <LanguageSwitch />
      <h1>{t('auth.forgot-password.title')}</h1>
      <p className={styles.lead}>{t('auth.forgot-password.lead')}</p>
      <MockBoundary explanationKey="auth.forgot-password.mock">
        {sent ? (
          <p role="status">{t('auth.forgot-password.confirm')}</p>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <Textfield
              id="forgot-identifier"
              labelKey="auth.forgot-password.identifier"
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              helperKey="auth.forgot-password.policy"
            />
            <p>{t('auth.forgot-password.channel')}</p>
            <div className={styles.demoList}>
              <Button
                variant={channel === 'email' ? 'primary' : 'ghost'}
                pressed={channel === 'email'}
                onClick={() => {
                  setChannel('email');
                }}
              >
                {t('auth.forgot-password.email')}
              </Button>
              <Button
                variant={channel === 'whatsapp' ? 'primary' : 'ghost'}
                pressed={channel === 'whatsapp'}
                onClick={() => {
                  setChannel('whatsapp');
                }}
              >
                {t('auth.forgot-password.whatsapp')}
              </Button>
            </div>
            <Button variant="primary" type="submit">
              {t('auth.forgot-password.submit')}
            </Button>
          </form>
        )}
      </MockBoundary>
      <Button variant="ghost" to="/sign-in">
        {t('auth.forgot-password.back')}
      </Button>
    </section>
  );
}
