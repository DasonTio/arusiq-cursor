/**
 * BarList — one figure across N things, ranked, with the comparison drawn.
 *
 * `client.energy` asked three questions in a row — which lever saved most,
 * which space used most, which unit used most — and answered all three with a
 * deck of full-width cards holding one number and one button each. Twenty-two
 * cards, about four thousand pixels of scroll, and the comparison the reader
 * came for left entirely to their memory of the number two cards ago.
 *
 * The rules here:
 *
 * - **Ranked.** The order IS the answer to "which one". A list in record
 *   order makes the reader do the sorting.
 * - **The bar is the comparison, the figure is the value.** Neither alone: a
 *   bar cannot be read off exactly and a column of numbers cannot be scanned.
 * - **Missing is not zero.** A null draws no bar at all and says so, rather
 *   than rendering as an empty track that looks like a measured nothing
 *   (INV-NO-FABRICATION).
 * - **The row is the link.** Not a button in the corner of every row (§4).
 *
 * @requirement FR-62
 */
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Icon } from '../components/Icon.tsx';
import { ProvenanceChip } from '../components/ProvenanceChip.tsx';
import type { BarListItem, BarListProps } from '../components/contracts.ts';
import styles from './BarList.module.css';

export function BarList({
  items,
  unit,
  provenance,
  accessibleNameKey,
  tone = 'accent',
}: BarListProps) {
  const { t, i18n } = useTranslation();
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);

  const measured = items
    .map((item) => item.value)
    .filter((value): value is number => value !== null);
  const max = measured.length > 0 ? Math.max(...measured, 0) : 0;

  // Ranked, and a row with no reading sorts last: it is not a small value,
  // it is an unknown one.
  const ranked = [...items].sort((a, b) => {
    if (a.value === null) return b.value === null ? 0 : 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });

  const row = (item: BarListItem) => (
    <>
      <span className={styles.name}>{item.name}</span>
      <span className={styles.track}>
        {item.value === null ? null : (
          <span
            className={styles.bar}
            style={{ inlineSize: max > 0 ? `${(item.value / max) * 100}%` : '0%' }}
          />
        )}
      </span>
      <span className={styles.value}>
        {item.value === null ? (
          t('loadState.noData')
        ) : (
          <>
            {number(item.value)}
            <span className={styles.unit}>{unit}</span>
          </>
        )}
      </span>
      {/* A per-row errand where the rows lead SOMEWHERE DIFFERENT, a chevron
          where they all lead to the same kind of place. Nine rows each saying
          "Open the unit" is nine repetitions of the word "unit" beside nine
          unit names. */}
      {item.hintKey ? (
        <span className={styles.hint}>{t(item.hintKey)}</span>
      ) : item.href ? (
        <span className={styles.chevron}>
          <Icon icon={ChevronRight} size={16} />
        </span>
      ) : (
        <span className={styles.hint} />
      )}
    </>
  );

  return (
    <figure className={`${styles.root} ${tone === 'eco' ? styles.eco : ''}`}>
      <ol className={styles.list} aria-label={t(accessibleNameKey)}>
        {ranked.map((item) => (
          <li key={item.id}>
            {item.href ? (
              <Link className={styles.row} to={item.href}>
                {row(item)}
              </Link>
            ) : (
              <div className={styles.row}>{row(item)}</div>
            )}
          </li>
        ))}
      </ol>
      <figcaption className={styles.provenance}>
        <ProvenanceChip provenance={provenance} />
      </figcaption>
    </figure>
  );
}
