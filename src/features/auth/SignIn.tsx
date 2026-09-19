/**
 * auth.sign-in — all
 *
 * Email or phone, password, language switch, seeded demo accounts one tap
 * apart. Lockout after five failures (D2: 15 minutes, same neutral wording).
 * The role router (S-2) picks the landing rail.
 *
 * @requirement FR-01 FR-04
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Textfield } from '../../components/Textfield.tsx';
import { DEMO_ACCOUNTS, LOCKOUT_MS } from '../../lib/simulation/auth.ts';
import { isNavReachable, landingPath } from '../../routes/navigation.ts';
import { useSession } from './session.ts';
import styles from './SignIn.module.css';

export default function SignIn() {
  const { t } = useTranslation();
  const { session, signIn, signInDemo } = useSession();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [lockMinutes, setLockMinutes] = useState(15);

  if (session) {
    const target =
      from && from !== '/sign-in' && isNavReachable(from, session.role)
        ? from
        : landingPath(session.role);
    return <Navigate to={target} replace />;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = signIn(identifier, password);
    if (result.ok) return;
    if (result.reason === 'locked') {
      const remaining = result.until
        ? Math.max(1, Math.ceil((result.until - Date.now()) / (60 * 1000)))
        : LOCKOUT_MS / (60 * 1000);
      setLockMinutes(remaining);
      setMessageKey('auth.sign-in.locked');
      return;
    }
    setMessageKey('auth.sign-in.invalid');
  }

  return (
    <section className={styles.card}>
      <h1>{t('auth.sign-in.title')}</h1>
      <p className={styles.lead}>{t('auth.sign-in.lead')}</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <Textfield
          id="identifier"
          labelKey="auth.sign-in.identifier"
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          helperKey="auth.sign-in.identifierHelp"
        />
        <Textfield
          id="password"
          labelKey="auth.sign-in.password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {messageKey ? (
          <p className={styles.alert} role="alert">
            {t(messageKey, { minutes: lockMinutes })}
          </p>
        ) : null}
        <Button variant="primary" type="submit">
          {t('auth.sign-in.submit')}
        </Button>
      </form>
      <p>
        <Button variant="ghost" to="/forgot-password">
          {t('auth.sign-in.forgot')}
        </Button>
      </p>
      <div className={styles.demo}>
        <p className={styles.demoLabel}>{t('auth.sign-in.demoTitle')}</p>
        <ul className={styles.demoList}>
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.id}>
              <Button variant="ghost" onClick={() => signInDemo(account.role)}>
                {t(`auth.sign-in.demo.${account.role}`)}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
