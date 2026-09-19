/**
 * client.billing — balance, mocked payment, notice delivery, restriction ladder.
 *
 * @requirement FR-50 FR-51 FR-52
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  RESTRICTION_STEP,
  isStepPermitted,
  restrictionSeverity,
} from '../../lib/domain/restriction.ts';
import {
  simulatedTelemetry,
  walkRooms,
  type AccountStanding,
  type Alert,
  type Property,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { ACCOUNT_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import Pay from '../shared/Pay.tsx';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from './Energy.module.css';

export default function Billing() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [home, setHome] = useState(null as Property | null);
  const [standing, setStanding] = useState(null as AccountStanding | null);
  const [notices, setNotices] = useState([] as Alert[]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    void simulatedTelemetry
      .listProperties(scope)
      .then(async (properties) => {
        const property = properties[0] ?? null;
        if (!property) {
          if (!cancelled) {
            setHome(null);
            setState('empty');
          }
          return;
        }
        const [nextStanding, alerts] = await Promise.all([
          simulatedTelemetry.getAccountStanding(scope, property.id),
          simulatedTelemetry.listAlerts(scope, { category: 'payment' }),
        ]);
        if (cancelled) return;
        setHome(property);
        setStanding(nextStanding);
        setNotices(alerts);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.billing.title')}</h1>
        <p className={styles.stateBody}>{t('client.billing.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('client.billing.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('client.billing.title')}</h1>
        <p className={styles.stateBody}>{t('client.billing.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('client.billing.retry')}
        </Button>
      </section>
    );
  }

  if (state === 'empty' || !home || !standing) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('client.billing.title')}</h1>
        <p className={styles.stateBody}>{t('client.billing.empty')}</p>
        <Button variant="primary" to="/home">
          {t('client.billing.emptyAction')}
        </Button>
      </section>
    );
  }

  const healthSensitive = walkRooms([home]).some((entry) => {
    return entry.room.healthSensitive;
  });
  const restriction = standing.restriction;

  if (params.get('pay') === 'balance') {
    return <Pay standing={standing} />;
  }

  return (
    <div className={styles.root}>
      <ViewTabs items={ACCOUNT_VIEWS} />
      <PageHeader titleKey="client.billing.title" contextKey="client.billing.purpose" />
      <Metric
        labelKey="client.billing.balance"
        value={standing.balanceIdr.value}
        unit="IDR"
        provenance={standing.balanceIdr.provenance}
        lastSeen={standing.balanceIdr.lastSeen}
      />
      <p className={styles.meta}>
        {t('client.billing.due', { time: formatDateTime(standing.dueAt) })}
      </p>
      <p>{t(`client.billing.state.${standing.state}`)}</p>
      <p className={styles.meta}>{t('client.billing.payMock')}</p>
      <Button variant="primary" to="/account?pay=balance">
        {t(standing.payAction.labelKey)}
      </Button>
      <section className={styles.section}>
        <SectionHeader titleKey="client.billing.methodsTitle" />
        <p className={styles.meta}>{t('client.billing.methodMock')}</p>
        <p>{t('client.billing.methodVa')}</p>
        <p>{t('client.billing.methodQris')}</p>
        <p>{t('client.billing.instructions')}</p>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="client.billing.noticesTitle" />
        <p className={styles.meta}>{t('client.billing.noticesMock')}</p>
        {notices.length === 0 ? (
          <p>{t('client.billing.noticesEmpty')}</p>
        ) : (
          <ul className={styles.list}>
            {notices.map((alert) => {
              return (
                <li key={alert.id} className={styles.card}>
                  <p className={styles.cardTitle}>{t(alert.titleKey)}</p>
                  <ProvenanceChip provenance={alert.provenance} />
                  {alert.delivery.map((item) => {
                    return (
                      <p key={`${item.channel}-${item.at}`} className={styles.meta}>
                        {t('client.alerts.deliveryLine', {
                          channel: t(`alertDelivery.channel.${item.channel}`),
                          state: t(`alertDelivery.state.${item.state}`),
                        })}
                      </p>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="client.billing.restrictionTitle" />
        {restriction ? (
          <>
            <p>{t('client.billing.restrictionCurrent')}</p>
            <SeverityIndicator severity={restrictionSeverity(restriction.step)} />
            <p>{t(`restriction.${restriction.step}`)}</p>
            <p>{t(restriction.reasonKey)}</p>
            <p>{t(`client.billing.change.${restriction.step}`)}</p>
            <p>{t(`client.billing.restore.${restriction.step}`)}</p>
            <p className={styles.meta}>
              {t('client.billing.restrictionGrace', {
                time: formatDateTime(restriction.graceEndsAt),
              })}
            </p>
            <p className={styles.meta}>
              {t('client.billing.restrictionApprovers', {
                requester: restriction.approval.requester,
                approver: restriction.approval.approver,
                time: formatDateTime(restriction.approval.at),
              })}
            </p>
            {restriction.healthSensitive || healthSensitive ? (
              <p>{t('client.billing.restrictionBlocked')}</p>
            ) : null}
          </>
        ) : (
          <p>{t('client.billing.restrictionNone')}</p>
        )}
        <h3 className={styles.sectionTitle}>{t('client.billing.ladderTitle')}</h3>
        <ol className={styles.list}>
          {RESTRICTION_STEP.map((step) => {
            const permitted = isStepPermitted(step, { healthSensitive });
            const current = restriction?.step === step;
            return (
              <li key={step} className={styles.card}>
                <SeverityIndicator severity={restrictionSeverity(step)} />
                <p className={styles.cardTitle}>{t(`restriction.${step}`)}</p>
                {current ? <p>{t('client.billing.restrictionCurrent')}</p> : null}
                {permitted ? null : <p>{t('client.billing.restrictionBlocked')}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
