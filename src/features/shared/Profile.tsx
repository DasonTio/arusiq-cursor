/**
 * shared.profile — all
 *
 * Language, sessions, and sign out here or everywhere. Notification channels
 * and consents wait on the rest of the account model.
 *
 * @requirement FR-02 FR-04
 */
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { LanguageSwitch } from './LanguageSwitch.tsx';
import { ViewTabs } from './ViewTabs.tsx';
import { useSession } from '../auth/session.ts';
import { ACCOUNT_VIEWS } from '../../routes/navigation.ts';
import styles from './Profile.module.css';

export function SessionActions() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const navigate = useNavigate();

  function leave(scope: 'this' | 'all') {
    signOut(scope);
    void navigate('/sign-in');
  }

  return (
    <div className={styles.actions}>
      <Button variant="primary" onClick={() => leave('this')}>
        {t('shared.profile.signOutThis')}
      </Button>
      <Button variant="ghost" onClick={() => leave('all')}>
        {t('shared.profile.signOutAll')}
      </Button>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { session } = useSession();

  return (
    <section className={styles.root}>
      {session?.role === 'client' ? <ViewTabs items={ACCOUNT_VIEWS} /> : null}
      <h1>{t('shared.profile.title')}</h1>
      <p className={styles.meta}>{session?.name}</p>
      <p className={styles.meta}>{t(`roles.${session?.role ?? 'client'}`)}</p>
      <LanguageSwitch />
      {session?.role === 'admin' ? (
        <div className={styles.actions}>
          <Button variant="ghost" to="/settings">
            {t('nav.admin.settings')}
          </Button>
          <Button variant="ghost" to="/audit">
            {t('nav.admin.audit')}
          </Button>
        </div>
      ) : null}
      <SessionActions />
    </section>
  );
}
