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
  const role = session?.role ?? 'client';

  return (
    <section className={styles.root}>
      {session?.role === 'client' ? <ViewTabs items={ACCOUNT_VIEWS} /> : null}
      <h1>{t('shared.profile.title')}</h1>

      {/* The screen was a heading, two grey lines and three controls loose on
          the canvas, with five hundred pixels of nothing under them. Three
          panels: who you are, what you have set, and how you leave. */}
      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby="profile-identity">
          <h2 className={styles.panelTitle} id="profile-identity">
            {t('shared.profile.identityTitle')}
          </h2>
          <p className={styles.name}>{session?.name}</p>
          {/* A role is a category, so it is a tinted chip rather than a third
              grey line — and it is the one fact on this screen that decides
              what the person can see. */}
          <p className={`${styles.roleChip} ${styles[role] ?? ''}`}>
            {t(`roles.${role}`)}
          </p>
        </section>

        <section className={styles.panel} aria-labelledby="profile-prefs">
          <h2 className={styles.panelTitle} id="profile-prefs">
            {t('shared.profile.preferencesTitle')}
          </h2>
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
        </section>

        <section className={styles.panel} aria-labelledby="profile-session">
          <h2 className={styles.panelTitle} id="profile-session">
            {t('shared.profile.sessionTitle')}
          </h2>
          <p className={styles.meta}>{t('shared.profile.sessionBody')}</p>
          <SessionActions />
        </section>
      </div>
    </section>
  );
}
