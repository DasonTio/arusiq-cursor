/**
 * Language switch. FR-04 requires it on every screen, including sign-in.
 *
 * @requirement FR-04
 */
import { useTranslation } from 'react-i18next';
import { LOCALES, setLocale, type Locale } from '../../lib/i18n/index.ts';
import styles from './LanguageSwitch.module.css';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const current: Locale = i18n.language.startsWith('id') ? 'id' : 'en';

  return (
    <label className={styles.root}>
      <span className={styles.caption}>{t('common.language')}</span>
      <select
        className={styles.select}
        value={current}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {(Object.keys(LOCALES) as Locale[]).map((locale) => (
          <option key={locale} value={locale}>
            {t(`language.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
