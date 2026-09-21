/**
 * admin.fleet — organisation tree. Units compose the shared unit object.
 *
 * @requirement FR-12 FR-13 FR-40 FR-83
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import type { TreeNode } from '../../components/contracts.ts';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  simulatedTelemetry,
  walkUnits,
  type Property,
} from '../../lib/simulation/index.ts';
import { AssetTree } from '../../patterns/AssetTree.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import Space from '../shared/Space.tsx';
import Unit from '../shared/Unit.tsx';
import styles from '../shared/Screen.module.css';

const href = (id: string) => `/fleet?node=${encodeURIComponent(id)}`;

export default function Fleet() {
  const { t, i18n } = useTranslation();
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
        <h1 className={styles.stateTitle}>{t('admin.fleet.title')}</h1>
        <p className={styles.stateBody}>{t('admin.fleet.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.fleet.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.fleet.title')}</h1>
        <p className={styles.stateBody}>{t('admin.fleet.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.fleet.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.fleet.title')}</h1>
        <p className={styles.stateBody}>{t('admin.fleet.empty')}</p>
      </section>
    );
  }

  if (nodeId && walkUnits(properties).some((unit) => unit.id === nodeId)) {
    return <Unit />;
  }

  const locatedRoom = nodeId ? locateRoom(properties, nodeId) : null;
  if (locatedRoom) {
    return (
      <Space
        property={locatedRoom.property}
        floor={locatedRoom.floor}
        room={locatedRoom.room}
        backTo="/fleet"
        unitHref={href}
      />
    );
  }

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  // FR-40 Activity — the per-unit command results, newest first. Group
  // commands are not in the simulated dataset and are not fabricated here.
  const activity = walkUnits(properties)
    .filter((unit) => unit.control.lastCommand !== null)
    .sort((a, b) => {
      return (
        Date.parse(b.control.lastCommand?.at ?? '') -
        Date.parse(a.control.lastCommand?.at ?? '')
      );
    });

  return (
    <div className={styles.root}>
      <PageHeader titleKey="admin.fleet.title" contextKey="admin.fleet.purpose" />
      <MockBoundary explanationKey="admin.fleet.mapMock">
        <AssetTree
          nodes={properties.map(toTreeNode)}
          labelKey="admin.fleet.title"
          sensitiveLabelKey="admin.fleet.healthSensitive"
        />
      </MockBoundary>
      <section className={styles.section} aria-label={t('admin.fleet.activityTitle')}>
        <h2 className={styles.sectionTitle}>{t('admin.fleet.activityTitle')}</h2>
        {activity.length === 0 ? (
          <p className={styles.meta}>{t('admin.fleet.activityEmpty')}</p>
        ) : (
          <ul className={styles.list}>
            {activity.map((unit) => {
              return (
                <li key={unit.id} className={styles.card}>
                  <div className={styles.nodeTop}>
                    <Button variant="ghost" to={href(unit.id)}>
                      {unit.name}
                    </Button>
                    <p>{t(`command.${unit.control.lastCommand?.state}`)}</p>
                  </div>
                  {unit.control.lastCommand ? (
                    <p className={styles.meta}>
                      {formatDateTime(unit.control.lastCommand.at)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The simulation's hierarchy, mapped into what the tree needs. The pattern
 * owns drawing a hierarchy; this screen owns what the hierarchy IS — which is
 * why the health-sensitive flag rides on the room here and the category rides
 * on the site.
 */
function toTreeNode(property: Property): TreeNode {
  return {
    id: property.id,
    name: property.name,
    href: href(property.id),
    metaKey: `category.${property.category}`,
    rollUp: property.rollUp,
    children: property.floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      nameKey: floor.nameKey,
      href: href(floor.id),
      rollUp: floor.rollUp,
      children: floor.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        href: href(room.id),
        healthSensitive: room.healthSensitive,
        rollUp: room.rollUp,
        children: room.units.map((unit) => ({
          id: unit.id,
          name: unit.name,
          href: href(unit.id),
          rollUp: unit.rollUp,
        })),
      })),
    })),
  };
}

function locateRoom(properties: Property[], nodeId: string) {
  for (const property of properties) {
    for (const floor of property.floors) {
      const room = floor.rooms.find((candidate) => candidate.id === nodeId);
      if (room) return { property, floor, room };
    }
  }
  return null;
}
