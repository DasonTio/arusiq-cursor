/**
 * client.spaces — household space tree. Rooms and units open the shared
 * object pages; this file only walks the hierarchy.
 *
 * @requirement FR-13 FR-14
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import type { TreeNode } from '../../components/contracts.ts';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  links,
  simulatedTelemetry,
  walkUnits,
  type Floor,
  type Property,
  type Room,
} from '../../lib/simulation/index.ts';
import { AssetTree } from '../../patterns/AssetTree.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import Space from '../shared/Space.tsx';
import Unit from '../shared/Unit.tsx';
import styles from './Spaces.module.css';

export default function Spaces() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const nodeId = params.get('node');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [properties, setProperties] = useState([] as Property[]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    void simulatedTelemetry
      .listProperties({ role: session.role, userId: session.userId })
      .then((next) => {
        if (cancelled) return;
        setProperties(next);
        setState(next.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.spaces.title')}</h1>
        <p className={styles.stateBody}>{t('client.spaces.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.spaces.loading')}</p>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.spaces.title')}</h1>
        <p className={styles.stateBody}>{t('client.spaces.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.spaces.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.spaces.title')}</h1>
        <p className={styles.stateBody}>{t('client.spaces.empty')}</p>
        <Button variant="primary" to="/home">
          {t('client.spaces.emptyAction')}
        </Button>
      </section>
    );
  }

  if (
    nodeId &&
    walkUnits(properties).some((unit) => {
      return unit.id === nodeId;
    })
  ) {
    return <Unit />;
  }

  const located = nodeId ? locate(properties, nodeId) : null;

  if (located?.type === 'room') {
    return (
      <Space
        property={located.property}
        floor={located.floor}
        room={located.room}
        backTo="/spaces"
        unitHref={(unitId) => links.unit(unitId)}
      />
    );
  }

  return (
    <div className={styles.root}>
      <PageHeader titleKey="client.spaces.title" contextKey="client.spaces.purpose" />
      {/* `?node=` opens one branch of the same tree rather than a different
          screen: a floor is still a floor with its rooms under it. */}
      <AssetTree
        nodes={
          located?.type === 'floor'
            ? [toFloorNode(located.floor)]
            : located?.type === 'property'
              ? [toTreeNode(located.property)]
              : properties.map(toTreeNode)
        }
        labelKey="client.spaces.title"
        sensitiveLabelKey="client.spaces.healthSensitive"
      />
    </div>
  );
}

/**
 * The household's hierarchy, mapped into what the tree needs. The pattern
 * owns drawing a hierarchy; this screen owns what the hierarchy IS — which is
 * why a room carries its floor as the quiet second line here, and its
 * category on the admin's copy.
 */
function toTreeNode(property: Property): TreeNode {
  return {
    id: property.id,
    name: property.name,
    href: links.node(property.id),
    metaKey: `category.${property.category}`,
    rollUp: property.rollUp,
    children: property.floors.map((floor) => toFloorNode(floor)),
  };
}

function toFloorNode(floor: Floor): TreeNode {
  return {
    id: floor.id,
    name: floor.name,
    nameKey: floor.nameKey,
    href: links.node(floor.id),
    rollUp: floor.rollUp,
    children: floor.rooms.map((room) => toRoomNode(room, floor)),
  };
}

function toRoomNode(room: Room, floor: Floor): TreeNode {
  return {
    id: room.id,
    name: room.name,
    href: links.node(room.id),
    metaKey: floor.nameKey,
    meta: floor.nameKey ? null : floor.name,
    healthSensitive: room.healthSensitive,
    rollUp: room.rollUp,
    // The leaf. It used to print the unit name TWICE — once as text and again
    // as the label of a ghost button beside it — and carried two links to the
    // same place. `SeverityRollUp` is the single anchor on a tree row.
    children: room.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      href: links.unit(unit.id),
      rollUp: unit.rollUp,
    })),
  };
}

function locate(properties: Property[], nodeId: string) {
  for (const property of properties) {
    if (property.id === nodeId) return { type: 'property' as const, property };
    for (const floor of property.floors) {
      if (floor.id === nodeId) return { type: 'floor' as const, property, floor };
      for (const room of floor.rooms) {
        if (room.id === nodeId) return { type: 'room' as const, property, floor, room };
      }
    }
  }
  return null;
}
