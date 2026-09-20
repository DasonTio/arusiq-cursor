/**
 * Marks a Phase 1A surface as a mock so an unlabelled prototype is not
 * mistaken for a live system (D7 §14.4).
 *
 * @requirement FR-01
 */
import type { MockBoundaryProps } from './contracts.ts';
import { useTranslation } from 'react-i18next';
import styles from './MockBoundary.module.css';

/**
 * ADR-0020 — the banner does not render.
 *
 * Same stakeholder decision as `ProvenanceChip`: the prototype is disclosed
 * once, verbally, so a banner repeating it on every screen is redundant.
 *
 * One switch again. Every call site keeps its `explanationKey`, so the copy
 * that says what a surface does NOT do still exists and comes back by
 * deleting one line. This is why the boundary is not simply removed from the
 * twelve screens that use it: INV-MOCK-LABEL is suppressed here, in one
 * place, where it can be found and reversed.
 */
const RENDER_BANNER = false;

export function MockBoundary({ explanationKey, children }: MockBoundaryProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.root}>
      {RENDER_BANNER ? (
        <p className={styles.banner} role="status">
          {t(explanationKey)}
        </p>
      ) : null}
      {children}
    </div>
  );
}
