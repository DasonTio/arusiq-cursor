/**
 * DataTable — repeating fields, in one panel.
 *
 * Five screens wanted this shape and three of them drew a deck of cards
 * instead: `admin.settings` published twenty-four part thresholds as twelve
 * cards of stacked sentences, `admin.audit` drew twenty-three identical
 * event cards in two columns so the chronology zig-zagged left-right-left,
 * and both used about twice the height a table needs.
 *
 * The component exists for the part a hand-written table forgets. Below the
 * 768 frame the columns stop holding, so the table RECOMPOSES rather than
 * shrinking: the header is clipped but stays in the accessibility tree, and
 * every cell becomes a block carrying its own column name. That only works if
 * EVERY cell has its label — which is precisely the thing nobody remembers to
 * add to the twelfth column — so the table writes it from the column
 * definition rather than trusting the caller.
 *
 * @requirement FR-27
 */
import { useTranslation } from 'react-i18next';
import type { DataTableProps } from '../components/contracts.ts';
import styles from './DataTable.module.css';

export function DataTable<Row>({
  captionKey,
  captionValues,
  columns,
  rows,
  rowKey,
}: DataTableProps<Row>) {
  const { t } = useTranslation();
  const columnClass = (column: (typeof columns)[number]) =>
    column.numeric ? styles.numeric : column.nowrap ? styles.nowrap : undefined;

  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <caption className="sr-only">{t(captionKey, captionValues)}</caption>
        <thead className={styles.head}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={columnClass(column)}>
                {t(column.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => {
                const content = column.cell(row);
                const className = columnClass(column);
                return column.rowHeader ? (
                  <th
                    key={column.key}
                    scope="row"
                    className={
                      className ? `${styles.rowHeader} ${className}` : styles.rowHeader
                    }
                    data-label={t(column.labelKey)}
                  >
                    {content}
                  </th>
                ) : (
                  <td
                    key={column.key}
                    className={className}
                    data-label={t(column.labelKey)}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
