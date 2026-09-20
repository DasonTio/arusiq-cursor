/**
 * Typographic provenance label. Colour is fully committed to severity and
 * is not available to borrow (D7 §11).
 *
 * `surface` selects the measured foreground pair rather than a look: the
 * light surfaces share gray-2, and the ADR-0005 hero uses the two inverse
 * tokens already measured against it (on-inverse-muted 5.27:1,
 * border-on-inverse 3.35:1). No new token, no second vocabulary.
 *
 * @requirement FR-15 FR-71
 */
import type { ProvenanceChipProps } from './contracts.ts';
import { PROVENANCE } from '../lib/domain/provenance.ts';
import { useTranslation } from 'react-i18next';
import styles from './ProvenanceChip.module.css';

/**
 * ADR-0020 — THE CHIP DOES NOT RENDER.
 *
 * The stakeholder decision is that provenance is disclosed once, verbally, at
 * the presentation, and that repeating it beside every figure is redundant:
 * `client.energy` alone carried eighteen of these marks.
 *
 * This is ONE SWITCH on purpose. Every call site, every `provenance` prop and
 * the whole domain model are untouched, so INV-AGGREGATE still computes the
 * weakest provenance of an aggregate, and the provenance gate still fails any
 * metric component that declares none. Restoring the labels is deleting the
 * two lines below — not re-threading twenty-one call sites.
 *
 * Read ADR-0020 before removing anything further: this suppresses the
 * DISPLAY of a guarantee, it does not remove the guarantee.
 */
const RENDER_PROVENANCE = false;

export function ProvenanceChip({ provenance, surface = 'page' }: ProvenanceChipProps) {
  const { t } = useTranslation();

  if (!RENDER_PROVENANCE) return null;

  return (
    <span className={styles.root} data-surface={surface}>
      {t(PROVENANCE[provenance].labelKey)}
    </span>
  );
}
