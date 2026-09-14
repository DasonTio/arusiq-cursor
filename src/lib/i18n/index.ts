/**
 * i18n runtime.
 *
 * D5 UR-LANG-01 — the whole product is switchable to any language, with English
 * and Bahasa Indonesia at launch and further languages added as locale packs
 * WITHOUT a code change. That requirement only holds if no user-facing string
 * ever reaches a component, which is why `tools/verify-i18n.mjs` and the
 * `arusiq/no-hardcoded-jsx-text` ESLint rule both gate on it.
 *
 * @requirement FR-04
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import id from './locales/id.json';

export const LOCALES = {
  en: { label: 'English', dir: 'ltr' as const },
  id: { label: 'Bahasa Indonesia', dir: 'ltr' as const },
} as const;

export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = 'en';

const STORAGE_KEY = 'arusiq.locale';

const isLocale = (v: string | null): v is Locale =>
  v !== null && Object.prototype.hasOwnProperty.call(LOCALES, v);

function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const nav = window.navigator.language.split('-')[0];
  return isLocale(nav) ? nav : DEFAULT_LOCALE;
}

/**
 * The root `lang` and `dir` attributes are part of the locale, not decoration.
 * `lang` drives screen-reader pronunciation and hyphenation; `dir` is how a
 * right-to-left locale becomes an attribute change rather than a rewrite
 * (D7 §19.2). index.html ships `lang="en"` as a static default; this keeps it
 * honest once the app boots.
 */
function syncDocument(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = LOCALES[locale].dir;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, id: { translation: id } },
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    // React already escapes. Double-escaping mangles Indonesian punctuation.
    escapeValue: false,
  },
  // A missing key must be loud in development. A stakeholder demo that renders
  // `client.overview.heroTitle` is embarrassing; one that silently renders the
  // English fallback hides the bug until after launch.
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: import.meta.env.DEV
    ? (lngs, _ns, key) => console.error(`[i18n] missing key "${key}" for ${lngs.join(', ')}`)
    : undefined,
});

syncDocument(i18n.language as Locale);
i18n.on('languageChanged', (lng) => syncDocument(lng as Locale));

export const setLocale = (locale: Locale): void => {
  window.localStorage.setItem(STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
};

export default i18n;
