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
import { SeverityRollUp } from '../../components/SeverityRollUp.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
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
        <ul className={styles.tree}>
          {properties.map((property) => {
            return (
              <li key={property.id} className={styles.node}>
                <PropertyBranch property={property} />
              </li>
            );
          })}
        </ul>
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
          href={href(property.id)}
        />
      </div>
      <ul className={styles.childList}>
        {property.floors.map((floor) => {
          return (
            <li key={floor.id} className={styles.node}>
              <FloorBranch floor={floor} />
            </li>
          );
        })}
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
          href={href(floor.id)}
        />
      </div>
      <ul className={styles.childList}>
        {floor.rooms.map((room) => {
          return (
            <li key={room.id} className={styles.node}>
              <RoomBranch room={room} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RoomBranch({ room }: { room: Room }) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.nodeTop}>
        <div>
          <p className={styles.nodeName}>{room.name}</p>
          {room.healthSensitive ? (
            <p className={styles.nodeMeta}>{t('admin.fleet.healthSensitive')}</p>
          ) : null}
        </div>
        <SeverityRollUp
          severity={room.rollUp.severity}
          contributing={room.rollUp.contributing}
          total={room.rollUp.total}
          href={href(room.id)}
        />
      </div>
      <ul className={styles.childList}>
        {room.units.map((unit) => {
          return (
            <li key={unit.id} className={styles.node}>
              <div className={styles.nodeTop}>
                <p className={styles.nodeName}>{unit.name}</p>
                <Button variant="ghost" to={href(unit.id)}>
                  {unit.name}
                </Button>
              </div>
              <SeverityRollUp
                severity={unit.rollUp.severity}
                contributing={unit.rollUp.contributing}
                total={unit.rollUp.total}
                href={href(unit.id)}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
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
