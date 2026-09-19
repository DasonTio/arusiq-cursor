/**
 * Unauthorised deep link. D2 UF-01: land on "not available for your role",
 * never on an empty copy of someone else's page.
 *
 * @requirement FR-34
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { useSession } from '../auth/session.ts';
import { landingPath } from '../../routes/navigation.ts';
import styles from './NotAvailable.module.css';

export default function NotAvailable() {
  const { t } = useTranslation();
  const { session } = useSession();
  const to = session ? landingPath(session.role) : '/sign-in';

  return (
    <section className={styles.root}>
      <h1>{t('shell.notAvailable.title')}</h1>
      <p>{t('shell.notAvailable.body')}</p>
      <Button variant="primary" to={to}>
        {t('shell.notAvailable.back')}
      </Button>
    </section>
  );
}
