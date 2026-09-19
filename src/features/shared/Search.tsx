/**
 * shared.search — units, spaces and visits in the caller's scope.
 *
 * @requirement FR-13
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Textfield } from '../../components/Textfield.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  links,
  simulatedTelemetry,
  walkRooms,
  walkUnits,
  type Property,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import { useSession } from '../auth/session.ts';
import styles from './Screen.module.css';

const matches = (haystack: string, query: string): boolean =>
  haystack.toLowerCase().includes(query.trim().toLowerCase());

export default function Search() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [properties, setProperties] = useState([] as Property[]);
  const [orders, setOrders] = useState([] as WorkOrderSummary[]);
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    void Promise.all([
      simulatedTelemetry.listProperties(scope),
      simulatedTelemetry.listWorkOrders(scope),
    ])
      .then(([nextProperties, nextOrders]) => {
        if (cancelled) return;
        setProperties(nextProperties);
        setOrders(nextOrders);
        setState(
          nextProperties.length === 0 && nextOrders.length === 0 ? 'empty' : 'ready',
        );
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
        <h1 className={styles.stateTitle}>{t('shared.search.title')}</h1>
        <p className={styles.stateBody}>{t('shared.search.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('shared.search.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('shared.search.title')}</h1>
        <p className={styles.stateBody}>{t('shared.search.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('shared.search.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('shared.search.title')}</h1>
        <p className={styles.stateBody}>{t('shared.search.empty')}</p>
      </section>
    );
  }

  const units = walkUnits(properties).filter((unit) => {
    return query.trim() === '' || matches(unit.name, query);
  });
  const rooms = walkRooms(properties)
    .map((entry) => entry.room)
    .filter((room) => {
      return query.trim() === '' || matches(room.name, query);
    });
  const visits = orders.filter((order) => {
    const title = t(order.titleKey);
    const name = order.unitName ?? '';
    return query.trim() === '' || matches(title, query) || matches(name, query);
  });
  const none = units.length === 0 && rooms.length === 0 && visits.length === 0;
  const unitHref = (unitId: string) => {
    if (session.role === 'admin') return `/fleet?node=${encodeURIComponent(unitId)}`;
    if (session.role === 'client') return links.unit(unitId);
    const related = orders.find((order) => order.scope.unitId === unitId);
    return related ? related.action.href : '/work';
  };
  const roomHref = (roomId: string) => {
    if (session.role === 'admin') return `/fleet?node=${encodeURIComponent(roomId)}`;
    return links.node(roomId);
  };

  return (
    <div className={styles.root}>
      <header className={styles.intro}>
        <h1>{t('shared.search.title')}</h1>
        <p>{t('shared.search.purpose')}</p>
      </header>
      <Textfield
        id="search-query"
        labelKey="shared.search.query"
        value={query}
        onChange={setQuery}
      />
      {none ? <p>{t('shared.search.noMatch')}</p> : null}
      <h2 className={styles.sectionTitle}>{t('shared.search.units')}</h2>
      <ul className={styles.list}>
        {units.map((unit) => {
          return (
            <li key={unit.id} className={styles.card}>
              <p className={styles.cardTitle}>{unit.name}</p>
              <Button variant="ghost" to={unitHref(unit.id)}>
                {unit.name}
              </Button>
            </li>
          );
        })}
      </ul>
      <h2 className={styles.sectionTitle}>{t('shared.search.spaces')}</h2>
      <ul className={styles.list}>
        {rooms.map((room) => {
          return (
            <li key={room.id} className={styles.card}>
              <p className={styles.cardTitle}>{room.name}</p>
              <Button variant="ghost" to={roomHref(room.id)}>
                {room.name}
              </Button>
            </li>
          );
        })}
      </ul>
      <h2 className={styles.sectionTitle}>{t('shared.search.visits')}</h2>
      <ul className={styles.list}>
        {visits.map((order) => {
          return (
            <li key={order.id} className={styles.card}>
              <p className={styles.cardTitle}>{t(order.titleKey)}</p>
              <Button variant="ghost" to={order.action.href}>
                {t(order.action.labelKey)}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
