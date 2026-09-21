/**
 * admin.restriction-case — one object for the whole ladder (FR-52): the rung
 * in force on an account, its timer, the dual-approval decision record and the
 * notice history that evidences consent.
 *
 * Read-only by design: this is the RECORD of the ladder, not the gate. The
 * decision itself is taken on `shared.approve`, which OD-01 and OD-02 blocked
 * until ADR-0015 settled them (2026-09-19) — two-person control on rungs 1–3,
 * a named management sign-off on rung 4, and a request-and-review record for
 * the health-sensitive flag that makes `stop` unreachable.
 *
 * @requirement FR-52
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  simulatedTelemetry,
  type AccountStanding,
  type Alert,
  type Property,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { RestrictionLadder } from '../../patterns/RestrictionLadder.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';

export default function RestrictionCase() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const propertyId = params.get('property');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [property, setProperty] = useState(null as Property | null);
  const [standing, setStanding] = useState(null as AccountStanding | null);
  const [notices, setNotices] = useState([] as Alert[]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session || !propertyId) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    void Promise.all([
      simulatedTelemetry.listProperties(scope),
      simulatedTelemetry.getAccountStanding(scope, propertyId),
    ])
      .then(async ([properties, nextStanding]) => {
        const nextProperty = properties.find((item) => item.id === propertyId) ?? null;
        const alerts = nextProperty ? await simulatedTelemetry.listAlerts(scope) : [];
        if (cancelled) return;
        setProperty(nextProperty);
        setStanding(nextStanding);
        setNotices(
          alerts.filter((alert) => {
            return (
              alert.category === 'payment' && alert.scope.propertyId === propertyId
            );
          }),
        );
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, propertyId, retry]);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.case.title')}</h1>
        <p className={styles.stateBody}>{t('admin.case.error')}</p>
      </section>
    );
  }

  if (!propertyId) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.case.title')}</h1>
        <p className={styles.stateBody}>{t('admin.case.missing')}</p>
        <Button variant="ghost" to="/accounts">
          {t('admin.case.back')}
        </Button>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.case.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.case.title')}</h1>
        <p className={styles.stateBody}>{t('admin.case.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.case.retry')}
        </Button>
      </section>
    );
  }

  if (!property) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.case.title')}</h1>
        <p className={styles.stateBody}>{t('admin.case.notFound')}</p>
        <Button variant="ghost" to="/accounts">
          {t('admin.case.back')}
        </Button>
      </section>
    );
  }

  const restriction = standing?.restriction ?? null;

  if (!restriction) {
    // Good news, stated plainly rather than as an error.
    return (
      <div className={styles.root}>
        <Button variant="ghost" to="/accounts">
          {t('admin.case.back')}
        </Button>
        <PageHeader titleKey="admin.case.title" contextKey="admin.case.purpose" />
        <p>{property.name}</p>
        <section className={styles.state}>
          <p className={styles.stateBody}>{t('admin.case.none')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Button variant="ghost" to="/accounts">
        {t('admin.case.back')}
      </Button>
      <PageHeader titleKey="admin.case.title" contextKey="admin.case.purpose" />
      <p>{property.name}</p>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.case.accountTitle" />
        {standing ? (
          <>
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
          </>
        ) : null}
        <p>{t(restriction.reasonKey)}</p>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.case.ladderTitle" />
        <RestrictionLadder
          current={restriction.step}
          healthSensitive={restriction.healthSensitive}
          labelKey="admin.case.ladderTitle"
        />
        <p className={styles.meta}>
          {t('client.billing.restrictionGrace', {
            time: formatDateTime(restriction.graceEndsAt),
          })}
        </p>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.case.approvalsTitle" />
        <p>
          {t('client.billing.restrictionApprovers', {
            requester: restriction.approval.requester,
            approver: restriction.approval.approver,
            time: formatDateTime(restriction.approval.at),
          })}
        </p>
        {/* ADR-0015 OD-02 — rung 4 carries a named management sign-off on top
            of the two-person approval. This screen exists to BE the record of
            the ladder, so omitting the third signature made the heaviest rung
            look like every other one. */}
        {restriction.approval.signedOff ? (
          <p>
            {t('admin.approve.decidedSignedOff', {
              name: restriction.approval.signedOff.manager,
              time: formatDateTime(restriction.approval.signedOff.at),
            })}
          </p>
        ) : null}
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.case.evidenceTitle" />
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
    </div>
  );
}
