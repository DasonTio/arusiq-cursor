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
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import {
  simulatedTelemetry,
  type AccountStanding,
  type Alert,
  type Property,
} from '../../lib/simulation/index.ts';
import { FactStrip } from '../../patterns/FactStrip.tsx';
import { NoticeList } from '../../patterns/NoticeList.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { RestrictionLadder } from '../../patterns/RestrictionLadder.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';
import account from './RestrictionCase.module.css';

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
      {/* The account this case is about — the site name was a bare paragraph
          floating between the heading and a stack of six more. */}
      <div className={account.account}>
        <div className={account.accountFigure}>
          <p className={account.site}>{property.name}</p>
          {standing ? (
            <Metric
              labelKey="client.billing.balance"
              value={standing.balanceIdr.value}
              unit="IDR"
              provenance={standing.balanceIdr.provenance}
              lastSeen={standing.balanceIdr.lastSeen}
            />
          ) : null}
        </div>
        {standing ? (
          <FactStrip
            columns={2}
            fields={[
              {
                labelKey: 'client.billing.standingLabel',
                value: t(`client.billing.state.${standing.state}`),
              },
              {
                labelKey: 'client.billing.dueLabel',
                value: (
                  <time dateTime={standing.dueAt}>
                    {formatDateTime(standing.dueAt)}
                  </time>
                ),
              },
              {
                labelKey: 'client.billing.reasonLabel',
                wide: true,
                value: t(restriction.reasonKey),
              },
            ]}
          />
        ) : null}
      </div>
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
        {/* ADR-0015 OD-02 — rung 4 carries a named management sign-off on top
            of the two-person approval. This screen exists to BE the record of
            the ladder, so omitting the third signature made the heaviest rung
            look like every other one. */}
        <div className={account.record}>
          <FactStrip
            columns={2}
            fields={[
              {
                labelKey: 'client.billing.approvalsLabel',
                wide: !restriction.approval.signedOff,
                value: t('client.billing.restrictionApprovers', {
                  requester: restriction.approval.requester,
                  approver: restriction.approval.approver,
                  time: formatDateTime(restriction.approval.at),
                }),
              },
              ...(restriction.approval.signedOff
                ? [
                    {
                      labelKey: 'admin.case.signOffLabel' as const,
                      value: t('admin.approve.decidedSignedOff', {
                        name: restriction.approval.signedOff.manager,
                        time: formatDateTime(restriction.approval.signedOff.at),
                      }),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </section>
      <section className={styles.section}>
        <SectionHeader titleKey="admin.case.evidenceTitle" />
        {notices.length === 0 ? (
          <p>{t('client.billing.noticesEmpty')}</p>
        ) : (
          /* No link here, unlike the resident's copy of the same list: this is
             the record that consent was given, and a record does not
             navigate. */
          <NoticeList notices={notices} />
        )}
      </section>
    </div>
  );
}
