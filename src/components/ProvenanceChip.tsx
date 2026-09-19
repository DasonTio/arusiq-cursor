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

export function ProvenanceChip({ provenance, surface = 'page' }: ProvenanceChipProps) {
  const { t } = useTranslation();

  return (
    <span className={styles.root} data-surface={surface}>
      {t(PROVENANCE[provenance].labelKey)}
    </span>
  );
}
