/**
 * AssetTree — the asset hierarchy as a tree.
 *
 * `client.spaces` and `admin.fleet` walk the same four levels — property,
 * floor, room, unit — and each drew them as cards inside cards inside cards.
 * Every level added a border, a radius and a shadow, so a unit sat four boxes
 * deep and the page read as packaging rather than as structure. Fleet was
 * fixed; Spaces was not, which is how a screen ends up four levels deep in
 * boxes using a third of a 1440 window.
 *
 * Depth is indentation and a connector hairline. There is exactly ONE panel —
 * the tree — and everything inside it is a row.
 *
 * `SeverityRollUp` is documented as "one anchor, not a row of controls", so
 * it is the single tab stop on every row and the name beside it is plain
 * text. Spaces printed each unit's name twice — once as text and again as the
 * label of a ghost button — and carried two links to the same place.
 *
 * @requirement FR-13 FR-14
 */
import { useTranslation } from 'react-i18next';
import { SeverityRollUp } from '../components/SeverityRollUp.tsx';
import type { AssetTreeProps, TreeNode } from '../components/contracts.ts';
import styles from './AssetTree.module.css';

function Branch({
  node,
  depth,
  sensitiveLabelKey,
}: {
  node: TreeNode;
  depth: number;
  sensitiveLabelKey: AssetTreeProps['sensitiveLabelKey'];
}) {
  const { t } = useTranslation();
  const name = node.nameKey ? t(node.nameKey) : node.name;
  const meta = node.metaKey ? t(node.metaKey) : (node.meta ?? null);

  return (
    <>
      {/* The top of the tree carries the weight. A floor and a room are
          structure; a unit is the thing you actually open. */}
      <div className={depth === 0 ? `${styles.row} ${styles.site}` : styles.row}>
        <div className={styles.rowText}>
          <p className={styles.name}>{name}</p>
          {meta ? <p className={styles.meta}>{meta}</p> : null}
          {node.healthSensitive ? (
            <p className={styles.sensitive}>{t(sensitiveLabelKey)}</p>
          ) : null}
        </div>
        <SeverityRollUp
          severity={node.rollUp.severity}
          contributing={node.rollUp.contributing}
          total={node.rollUp.total}
          href={node.href}
        />
      </div>
      {node.children && node.children.length > 0 ? (
        <ul className={styles.branch}>
          {node.children.map((child) => (
            <li key={child.id}>
              <Branch
                node={child}
                depth={depth + 1}
                sensitiveLabelKey={sensitiveLabelKey}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function AssetTree({ nodes, labelKey, sensitiveLabelKey }: AssetTreeProps) {
  const { t } = useTranslation();
  return (
    <ul className={styles.tree} aria-label={t(labelKey)}>
      {nodes.map((node) => (
        <li key={node.id}>
          <Branch node={node} depth={0} sensitiveLabelKey={sensitiveLabelKey} />
        </li>
      ))}
    </ul>
  );
}
