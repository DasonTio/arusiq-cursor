/**
 * Icon primitive. Stroke weight is not a prop — ADR-0006 locks it at 2 so
 * two glyphs cannot drift apart.
 *
 * @requirement FR-20
 */
import type { IconProps } from './contracts.ts';
import { useTranslation } from 'react-i18next';
import styles from './Icon.module.css';

export function Icon({ icon: Glyph, size = 24, labelKey }: IconProps) {
  const { t } = useTranslation();
  return (
    <Glyph
      size={size}
      strokeWidth={2}
      className={styles.root}
      aria-hidden={labelKey ? undefined : true}
      aria-label={labelKey ? t(labelKey) : undefined}
      focusable="false"
    />
  );
}
