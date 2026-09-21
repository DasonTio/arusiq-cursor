/**
 * client.billing — balance, payment hand-off, notice delivery, restriction
 * ladder.
 *
 * @requirement FR-50 FR-51 FR-52
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Landmark, QrCode } from 'lucide-react';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { restrictionSeverity } from '../../lib/domain/restriction.ts';
import {
  simulatedTelemetry,
  walkRooms,
  type AccountStanding,
  type Alert,
  type Property,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { RestrictionLadder } from '../../patterns/RestrictionLadder.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { ACCOUNT_VIEWS } from '../../routes/navigation.ts';
import { useSession } from '../auth/session.ts';
import Pay from '../shared/Pay.tsx';
import { ViewTabs } from '../shared/ViewTabs.tsx';
import styles from './Energy.module.css';
import account from './Billing.module.css';

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
      {/* What is owed, what state that puts the account in, and the one thing
          to do about it — one panel, because it is one statement. */}
      <div className={account.account}>
        <div className={account.accountFigure}>
          <Metric
            labelKey="client.billing.balance"
            value={standing.balanceIdr.value}
            unit="IDR"
            provenance={standing.balanceIdr.provenance}
            lastSeen={standing.balanceIdr.lastSeen}
          />
          <p className={`${account.standing} ${account[standing.state]}`}>
            {t(`client.billing.state.${standing.state}`)}
          </p>
          <p className={styles.meta}>
            {t('client.billing.due', { time: formatDateTime(standing.dueAt) })}
          </p>
        </div>
        <div className={account.accountAction}>
          <Button variant="primary" to="/account?pay=balance">
            {t(standing.payAction.labelKey)}
          </Button>
          <p className={styles.meta}>{t('client.billing.payMock')}</p>
        </div>
      </div>
      <section className={styles.section}>
        <SectionHeader titleKey="client.billing.methodsTitle" />
        <div className={account.methods}>
          <div className={account.method}>
            <span className={account.methodChip}>
              <Icon icon={Landmark} size={20} />
            </span>
            <p className={account.methodName}>{t('client.billing.methodVa')}</p>
          </div>
          <div className={account.method}>
            <span className={account.methodChip}>
              <Icon icon={QrCode} size={20} />
            </span>
            <p className={account.methodName}>{t('client.billing.methodQris')}</p>
          </div>
        </div>
        <p className={styles.meta}>{t('client.billing.instructions')}</p>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="client.billing.noticesTitle" />
        {notices.length === 0 ? (
          <p>{t('client.billing.noticesEmpty')}</p>
        ) : (
          <ul className={account.notices}>
            {notices.map((alert) => {
              return (
                <li key={alert.id}>
                  {/* The row is the link. A notice that cannot be opened is a
                      dead end, and the notice is where the restriction that
                      follows was first explained (INV-NO-DEAD-END). */}
                  <Link className={account.noticeLink} to={`/alerts?alert=${alert.id}`}>
                    <SeverityIndicator severity={alert.severity} />
                    <span className={account.noticeBody}>
                      <span className={account.noticeTitle}>{t(alert.titleKey)}</span>
                      <ProvenanceChip provenance={alert.provenance} />
                      <span className={account.delivery}>
                        {alert.delivery.map((item) => {
                          return (
                            <span
                              key={`${item.channel}-${item.at}`}
                              className={account.deliveryItem}
                            >
                              {t('client.alerts.deliveryLine', {
                                channel: t(`alertDelivery.channel.${item.channel}`),
                                state: t(`alertDelivery.state.${item.state}`),
                              })}
                            </span>
                          );
                        })}
                      </span>
                    </span>
                    <span className={account.noticeHint}>
                      {t('client.billing.noticeOpen')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="client.billing.restrictionTitle" />
        {restriction ? (
          <div className={account.restriction}>
            <div className={account.restrictionTop}>
              <SeverityIndicator severity={restrictionSeverity(restriction.step)} />
              <p className={account.restrictionStep}>
                {t(`restriction.${restriction.step}`)}
              </p>
            </div>
            {/* Six sentences in a column were six things to read before the
                reader knew whether their cooling was affected. The same six
                facts, labelled, are six things to scan. */}
            <dl className={account.facts}>
              <div className={account.fact}>
                <dt className={account.factLabel}>{t('client.billing.reasonLabel')}</dt>
                <dd className={account.factValue}>{t(restriction.reasonKey)}</dd>
              </div>
              <div className={account.fact}>
                <dt className={account.factLabel}>
                  {t('client.billing.restrictionChanges')}
                </dt>
                <dd className={account.factValue}>
                  {t(`client.billing.change.${restriction.step}`)}
                </dd>
              </div>
              <div className={account.fact}>
                <dt className={account.factLabel}>
                  {t('client.billing.restrictionRestores')}
                </dt>
                <dd className={account.factValue}>
                  {t(`client.billing.restore.${restriction.step}`)}
                </dd>
              </div>
              <div className={account.fact}>
                <dt className={account.factLabel}>{t('client.billing.graceLabel')}</dt>
                <dd className={account.factValue}>
                  <time dateTime={restriction.graceEndsAt}>
                    {formatDateTime(restriction.graceEndsAt)}
                  </time>
                </dd>
              </div>
              <div className={`${account.fact} ${account.factWide}`}>
                <dt className={account.factLabel}>
                  {t('client.billing.approvalsLabel')}
                </dt>
                <dd className={account.factValue}>
                  {t('client.billing.restrictionApprovers', {
                    requester: restriction.approval.requester,
                    approver: restriction.approval.approver,
                    time: formatDateTime(restriction.approval.at),
                  })}
                </dd>
              </div>
            </dl>
            {/* The `stop` guarantee is NOT repeated here. It is stated on the
                rung it concerns, in the ladder directly below — printing the
                same sentence twice, a screen apart, made it read as boilerplate
                rather than as the promise it is. */}
          </div>
        ) : (
          <p>{t('client.billing.restrictionNone')}</p>
        )}
        <h3 className={styles.sectionTitle}>{t('client.billing.ladderTitle')}</h3>
        <RestrictionLadder
          current={restriction?.step ?? null}
          healthSensitive={healthSensitive}
          labelKey="client.billing.ladderTitle"
        />
      </section>
    </div>
  );
}
