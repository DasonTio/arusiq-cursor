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
import { SeverityRollUp } from '../../components/SeverityRollUp.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  links,
  simulatedTelemetry,
  walkUnits,
  type Floor,
  type Property,
  type Room,
} from '../../lib/simulation/index.ts';
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
      <Tree located={located} properties={properties} />
    </div>
  );
}

function Tree({
  located,
  properties,
}: {
  located: ReturnType<typeof locate>;
  properties: Property[];
}) {
  if (located?.type === 'room') {
    return <RoomBranch room={located.room} floor={located.floor} />;
  }
  if (located?.type === 'floor') {
    return <FloorBranch floor={located.floor} />;
  }
  if (located?.type === 'property') {
    return <PropertyBranch property={located.property} />;
  }
  return (
    <ul className={styles.tree}>
      {properties.map((property) => (
        <li key={property.id} className={styles.node}>
          <PropertyBranch property={property} />
        </li>
      ))}
    </ul>
  );
}

function PropertyBranch({ property }: { property: Property }) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.nodeTop}>
        <div>
          <p className={styles.nodeName}>{property.name}</p>
          <p className={styles.nodeMeta}>{t(`category.${property.category}`)}</p>
        </div>
        <SeverityRollUp
          severity={property.rollUp.severity}
          contributing={property.rollUp.contributing}
          total={property.rollUp.total}
          href={links.node(property.id)}
        />
      </div>
      <ul className={styles.childList}>
        {property.floors.map((floor) => (
          <li key={floor.id} className={styles.node}>
            <FloorBranch floor={floor} />
          </li>
        ))}
      </ul>
    </>
  );
}

function FloorBranch({ floor }: { floor: Floor }) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.nodeTop}>
        <p className={styles.nodeName}>
          {floor.nameKey ? t(floor.nameKey) : floor.name}
        </p>
        <SeverityRollUp
          severity={floor.rollUp.severity}
          contributing={floor.rollUp.contributing}
          total={floor.rollUp.total}
          href={links.node(floor.id)}
        />
      </div>
      <ul className={styles.childList}>
        {floor.rooms.map((room) => (
          <li key={room.id} className={styles.node}>
            <RoomBranch room={room} floor={floor} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RoomBranch({ room, floor }: { room: Room; floor: Floor }) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.nodeTop}>
        <div>
          <p className={styles.nodeName}>{room.name}</p>
          <p className={styles.nodeMeta}>
            {floor.nameKey ? t(floor.nameKey) : floor.name}
          </p>
        </div>
        <SeverityRollUp
          severity={room.rollUp.severity}
          contributing={room.rollUp.contributing}
          total={room.rollUp.total}
          href={links.node(room.id)}
        />
      </div>
      <ul className={styles.childList}>
        {room.units.map((unit) => (
          <li key={unit.id} className={styles.node}>
            <div className={styles.nodeTop}>
              <p className={styles.nodeName}>{unit.name}</p>
              <Button variant="ghost" to={links.unit(unit.id)}>
                {t('client.spaces.open')}
              </Button>
            </div>
            <SeverityRollUp
              severity={unit.rollUp.severity}
              contributing={unit.rollUp.contributing}
              total={unit.rollUp.total}
              href={links.unit(unit.id)}
            />
          </li>
        ))}
      </ul>
    </>
  );
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
