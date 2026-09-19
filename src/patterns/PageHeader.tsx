/**
 * Page header for every archetype screen: the h1, an optional context line
 * under it, and a trailing slot the screen fills (a SeverityRollUp, filter
 * actions, a primary Button). Stacked on mobile; from the 768 frame the
 * text block and the trailing slot sit on one row, pushed apart.
 *
 * All text arrives as keys — screens own the locale strings (D5 UR-LANG-01).
 *
 * @requirement FR-10 FR-15
 */
import type { ReactNode } from 'react';
import type { I18nKey } from '../components/contracts.ts';
import { useTranslation } from 'react-i18next';
import styles from './PageHeader.module.css';

/** Interpolation values for a locale string. */
type Values = Record<string, unknown>;

export interface PageHeaderProps {
  titleKey?: I18nKey;
  titleValues?: Values;
  /** Free-text title (e.g. a unit or property name) — wins over titleKey,
   *  mirroring the context override below (D5 UR-LANG-01: free-text names
   *  are the documented exception to "every string is a key"). */
  title?: string;
  contextKey?: I18nKey;
  contextValues?: Values;
  /** Data context (e.g. the property name) — wins over contextKey when given. */
  context?: string;
  children?: ReactNode;
}

export function PageHeader({
  titleKey,
  titleValues,
  title,
  contextKey,
  contextValues,
  context,
  children,
}: PageHeaderProps) {
  const { t } = useTranslation();

  function renderTitle(): ReactNode {
    if (title) {
      return title;
    }
    if (titleKey) {
      return t(titleKey, titleValues);
    }
    return null;
  }

  function renderContext(): ReactNode {
    if (context) {
      return <p className={styles.context}>{context}</p>;
    }
    if (contextKey) {
      return <p className={styles.context}>{t(contextKey, contextValues)}</p>;
    }
    return null;
  }

  return (
    <header className={styles.root}>
      <div className={styles.text}>
        <h1 className={styles.title}>{renderTitle()}</h1>
        {renderContext()}
      </div>
      {children ? <div className={styles.trailing}>{children}</div> : null}
    </header>
  );
}
