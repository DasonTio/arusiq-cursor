/**
 * PriorityList — the severity-grouped work queue (technician Work, HQ
 * decisions): one section per group with a labelled header, and row cards
 * carrying a severity rail, title, optional detail, optional meta columns,
 * optional trailing status and a chevron. A row is one link when the screen
 * gives it a `to` path.
 *
 * The rail is colour alone, and colour never travels alone in this product
 * (D5 UR-MNT-01) — so every row also composes the SeverityIndicator, which
 * carries colour + shape + label. The rail is emphasis; the indicator is the
 * severity expression. Removing the indicator is a spec violation, not a
 * simplification.
 *
 * @requirement FR-12 FR-25
 */
import type { ReactNode } from 'react';
import type { I18nKey } from '../components/contracts.ts';
import type { Severity } from '../lib/domain/severity.ts';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { SeverityIndicator } from '../components/SeverityIndicator.tsx';
import { Icon } from '../components/Icon.tsx';
import styles from './PriorityList.module.css';

/** Interpolation values for a locale string. */
type Values = Record<string, unknown>;

export interface PriorityMetaItem {
  /** Caption label above the value — always a locale key. */
  labelKey: I18nKey;
  labelValues?: Values;
  /**
   * Pre-formatted, locale-correct value (dates and numbers are formatted by
   * the screen, which owns the locale). `null` means the value is absent:
   * the absentKey sentence is rendered instead — missing is stated, never
   * faked (§4.4).
   */
  value: string | null;
  /** Stated-absence sentence, rendered when `value` is null. */
  absentKey?: I18nKey;
  absentValues?: Values;
}

export interface PriorityItem {
  id: string;
  titleKey?: I18nKey;
  titleValues?: Values;
  /** Free-text title (e.g. a property name) — wins over titleKey, mirroring
   *  PageHeader's context override (D5 UR-LANG-01: free-text names are the
   *  documented exception to "every string is a key"). */
  title?: string;
  detailKey?: I18nKey;
  detailValues?: Values;
  /** Free-text detail (e.g. a unit or property name) — wins over detailKey,
   *  mirroring the title override above. */
  detail?: string;
  severity: Severity;
  /** D6 FR-25 — a prediction stays suspected until a technician verdict;
   *  SeverityIndicator renders it as a dashed border, never a fifth colour. */
  suspected?: boolean;
  /**
   * Optional meta columns (SLA due, age, assignee): small labelled figures
   * that repeat on every row of a queue. The columns sit on their own line
   * inside the card; `align-items: start` keeps a short column from
   * stretching to match a taller neighbour.
   */
  meta?: readonly PriorityMetaItem[];
  statusKey?: I18nKey;
  statusValues?: Values;
  to?: string;
}

export interface PriorityGroup {
  id: string;
  labelKey: I18nKey;
  labelValues?: Values;
  items: readonly PriorityItem[];
}

export interface PriorityListProps {
  groups: readonly PriorityGroup[];
  ariaLabelKey: I18nKey;
}

export function PriorityList({ groups, ariaLabelKey }: PriorityListProps) {
  const { t } = useTranslation();

  function titleNode(item: PriorityItem): ReactNode {
    if (item.title) {
      return item.title;
    }
    if (item.titleKey) {
      return t(item.titleKey, item.titleValues);
    }
    return null;
  }

  function detailNode(item: PriorityItem): ReactNode {
    if (item.detail) {
      return item.detail;
    }
    if (item.detailKey) {
      return t(item.detailKey, item.detailValues);
    }
    return null;
  }

  const rowBody = (item: PriorityItem) => {
    return (
      <>
        <SeverityIndicator severity={item.severity} suspected={item.suspected} />
        <span className={styles.text}>
          <span className={styles.title}>{titleNode(item)}</span>
          {detailNode(item) ? (
            <span className={styles.detail}>{detailNode(item)}</span>
          ) : null}
        </span>
        {item.meta && item.meta.length > 0 ? (
          <span className={styles.meta}>
            {item.meta.map((meta) => {
              const value =
                meta.value ??
                (meta.absentKey ? t(meta.absentKey, meta.absentValues) : null);
              // A null value with no absentKey sentence means the screen never
              // decided what "missing" looks like here — render nothing rather
              // than a dangling label.
              if (value === null) return null;
              return (
                <span key={meta.labelKey} className={styles.metaItem}>
                  <span className={styles.metaLabel}>
                    {t(meta.labelKey, meta.labelValues)}
                  </span>
                  <span className={styles.metaValue}>{value}</span>
                </span>
              );
            })}
          </span>
        ) : null}
        {item.statusKey ? (
          <span className={styles.status}>{t(item.statusKey, item.statusValues)}</span>
        ) : null}
        <span className={styles.chevron}>
          <Icon icon={ChevronRight} size={16} />
        </span>
      </>
    );
  };

  return (
    <div className={styles.root} role="group" aria-label={t(ariaLabelKey)}>
      {groups.map((group) => (
        <section key={group.id} className={styles.group}>
          <h3 className={styles.groupTitle}>{t(group.labelKey, group.labelValues)}</h3>
          <ul className={styles.list}>
            {group.items.map((item) => {
              const className = `${styles.row} ${styles[item.severity]}`;
              return (
                <li key={item.id}>
                  {item.to ? (
                    <Link className={className} to={item.to}>
                      {rowBody(item)}
                    </Link>
                  ) : (
                    <div className={className}>{rowBody(item)}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
