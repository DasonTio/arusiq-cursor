/**
 * shared.approve (P-APPROVE) — the gate on the restriction ladder.
 *
 * Admin-only, so it lives here rather than in shared/ (ADR-0008: an object
 * used by one role stays in that role's directory). Phone-capable on purpose
 * — ADR-0008 keeps approve, acknowledge and dispatch working at 375 because
 * they are the three HQ actions that cannot wait for a desk.
 *
 * The governance it enforces is ADR-0015: two-person control on rungs 1–3, a
 * named management sign-off on rung 4, and a health-sensitive designation that
 * makes `stop` unreachable. None of those rules live here — the adapter
 * refuses, and this screen renders the refusal. A gate whose policy is in the
 * component is a gate a second screen can forget to implement.
 *
 * @requirement FR-52
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { Textfield } from '../../components/Textfield.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import { restrictionSeverity } from '../../lib/domain/restriction.ts';
import {
  simulatedTelemetry,
  type RestrictionRequest,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList, type PriorityGroup } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from '../shared/Screen.module.css';
import gate from './Approve.module.css';

/** The refusals an approver may record. Free text would not survive a locale
 *  switch, and an audit line nobody can read is not an audit line. */
const DECLINE_REASONS = [
  'restriction.decline.reason.paymentArranged',
  'restriction.decline.reason.balanceSettled',
  'restriction.decline.reason.evidenceInsufficient',
  'restriction.decline.reason.healthRisk',
] as const;

export default function Approve() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [queue, setQueue] = useState([] as RestrictionRequest[]);
  const [request, setRequest] = useState(null as RestrictionRequest | null);
  const [signedOffBy, setSignedOffBy] = useState('');
  const [declineReason, setDeclineReason] = useState(DECLINE_REASONS[0] as string);
  const [refusal, setRefusal] = useState(null as string | null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    const load = async () => {
      if (requestId) return simulatedTelemetry.getRestrictionRequest(scope, requestId);
      return null;
    };
    void Promise.all([
      simulatedTelemetry.listRestrictionRequests(scope, { state: 'pending' }),
      load(),
    ])
      .then(([pending, one]) => {
        if (cancelled) return;
        setQueue(pending);
        setRequest(one);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, requestId, retry]);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.approve.title')}</h1>
        <p className={styles.stateBody}>{t('admin.approve.error')}</p>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('admin.approve.loading')}</p>
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('admin.approve.title')}</h1>
        <p className={styles.stateBody}>{t('admin.approve.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('admin.approve.retry')}
        </Button>
      </section>
    );
  }

  const decide = (outcome: 'approve' | 'decline') => {
    if (!request) return;
    void simulatedTelemetry
      .decideRestrictionRequest(
        { role: session.role, userId: session.userId },
        request.id,
        {
          outcome,
          reasonKey: outcome === 'decline' ? declineReason : null,
          signedOffBy: outcome === 'approve' ? signedOffBy.trim() || null : null,
          decidedByName: session.name,
        },
      )
      .then((result) => {
        if (result.ok) {
          setRequest(result.request);
          setRefusal(null);
          setRetry((n) => n + 1);
          return;
        }
        // The adapter is the authority on policy; the screen renders its answer
        // rather than pre-judging which refusals are possible.
        setRefusal(result.reasonKey);
      });
  };

  /* ------------------------------------------------ the queue (no request) */

  if (!requestId) {
    const groups: PriorityGroup[] = [
      {
        id: 'pending',
        labelKey: 'admin.approve.queueTitle',
        items: queue.map((item) => ({
          id: item.id,
          title: item.spaceName,
          detail: item.propertyName,
          severity: restrictionSeverity(item.requestedStep),
          statusKey: `restriction.${item.requestedStep}`,
          to: `/accounts/approve?request=${encodeURIComponent(item.id)}`,
        })),
      },
    ];
    return (
      <div className={styles.root}>
        <PageHeader titleKey="admin.approve.title" contextKey="admin.approve.purpose" />
        {queue.length === 0 ? (
          <section className={styles.state}>
            <p className={styles.stateBody}>{t('admin.approve.queueEmpty')}</p>
          </section>
        ) : (
          <PriorityList groups={groups} ariaLabelKey="admin.approve.queueTitle" />
        )}
      </div>
    );
  }

  if (!request) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('admin.approve.title')}</h1>
        <p className={styles.stateBody}>{t('admin.approve.notFound')}</p>
        <Button variant="ghost" to="/accounts/approve">
          {t('admin.approve.back')}
        </Button>
      </section>
    );
  }

  /* --------------------------------------------- one request, one decision */

  const decided = request.decision !== null;
  const { evidence } = request;
  // Both answers come from the adapter: `permitted` is the FR-53 safety check,
  // `raisedByViewer` is ADR-0015's two-person control. The screen offers
  // Approve only where the adapter would accept it — and Decline stays
  // available in both cases, so neither refusal leaves the request stranded
  // in the queue with nothing an approver can do about it.
  const decidable = request.permitted && !request.raisedByViewer;

  return (
    <div className={styles.root}>
      <Button variant="ghost" to="/accounts/approve">
        {t('admin.approve.back')}
      </Button>
      <PageHeader titleKey="admin.approve.title" context={request.spaceName}>
        <SeverityIndicator severity={restrictionSeverity(request.requestedStep)} />
      </PageHeader>
      <p className={styles.meta}>{request.propertyName}</p>

      <section className={styles.section}>
        <SectionHeader titleKey="admin.approve.askTitle" />
        <p>
          {request.currentStep
            ? t('admin.approve.askLine', {
                from: t(`restriction.${request.currentStep}`),
                to: t(`restriction.${request.requestedStep}`),
              })
            : t('admin.approve.askFromNone', {
                to: t(`restriction.${request.requestedStep}`),
              })}
        </p>
        <p>{t(request.reasonKey)}</p>
        <p className={styles.meta}>
          {t('admin.approve.requestedBy', {
            name: request.requestedBy.name,
            time: formatDateTime(request.requestedAt),
          })}
        </p>
        <p className={styles.meta}>
          {t('admin.approve.expires', { time: formatDateTime(request.expiresAt) })}
        </p>
      </section>

      <section className={styles.section}>
        <SectionHeader titleKey="admin.approve.evidenceTitle" />
        <p>{t(request.evidenceSummaryKey)}</p>
        <Metric
          labelKey="client.billing.balance"
          value={evidence.balanceIdr.value}
          unit="IDR"
          provenance={evidence.balanceIdr.provenance}
          lastSeen={evidence.balanceIdr.lastSeen}
        />
        <p className={styles.meta}>
          {t('client.billing.due', { time: formatDateTime(evidence.dueAt) })}
        </p>
        <p className={styles.meta}>
          {t('admin.approve.daysOverdue', { count: evidence.daysOverdue })}
        </p>
        <p className={styles.meta}>{t('admin.approve.noticesTitle')}</p>
        {evidence.notices.length === 0 ? (
          <p>{t('admin.approve.noticesEmpty')}</p>
        ) : (
          <ul className={styles.list}>
            {evidence.notices.map((notice) => (
              <li key={`${notice.channel}-${notice.at}`} className={styles.meta}>
                {t('client.alerts.deliveryLine', {
                  channel: t(`alertDelivery.channel.${notice.channel}`),
                  state: t(`alertDelivery.state.${notice.state}`),
                })}
              </li>
            ))}
          </ul>
        )}
        <ProvenanceChip provenance={request.provenance} />
      </section>

      {/* D6 FR-53 — the check an approver must SEE before deciding. It is
          rendered whether or not the space is designated, because "we looked
          and it is not" is also a thing the record should be able to show. */}
      <section className={styles.section}>
        <SectionHeader titleKey="admin.approve.healthTitle" />
        {request.healthSensitive ? (
          <>
            <p>{t('admin.approve.healthDesignated')}</p>
            {request.healthSensitiveDesignation ? (
              <>
                <p>{t(request.healthSensitiveDesignation.evidenceKey)}</p>
                <p className={styles.meta}>
                  {t('admin.approve.healthRequestedBy', {
                    name: request.healthSensitiveDesignation.requestedBy.name,
                    time: formatDateTime(
                      request.healthSensitiveDesignation.requestedAt,
                    ),
                  })}
                </p>
                <p className={styles.meta}>
                  {t('admin.approve.healthApprovedBy', {
                    name: request.healthSensitiveDesignation.approvedBy.name,
                    time: formatDateTime(request.healthSensitiveDesignation.approvedAt),
                  })}
                </p>
                <p className={styles.meta}>
                  {t('admin.approve.healthReviewBy', {
                    time: formatDateTime(request.healthSensitiveDesignation.reviewBy),
                  })}
                </p>
              </>
            ) : null}
          </>
        ) : (
          <p>{t('admin.approve.healthNotDesignated')}</p>
        )}
      </section>

      {decided ? (
        <section className={styles.section}>
          <SectionHeader titleKey="admin.approve.decidedTitle" />
          <p>
            {t(
              request.decision?.outcome === 'approved'
                ? 'admin.approve.decidedApproved'
                : 'admin.approve.decidedDeclined',
              {
                name: request.decision?.decidedBy ?? '',
                time: formatDateTime(
                  request.decision?.decidedAt ?? request.requestedAt,
                ),
              },
            )}
          </p>
          {request.decision?.reasonKey ? <p>{t(request.decision.reasonKey)}</p> : null}
          {request.decision?.signedOff ? (
            <p className={styles.meta}>
              {t('admin.approve.decidedSignedOff', {
                name: request.decision.signedOff.manager,
                time: formatDateTime(request.decision.signedOff.at),
              })}
            </p>
          ) : null}
        </section>
      ) : (
        <>
          {/* Refusable on sight. The approve action is not offered as though it
              might work — but declining stays available, so a request that
              policy forbids is still formally answerable rather than a dead
              end in the queue. */}
          {decidable ? null : (
            <section className={gate.refusal} role="status">
              <SectionHeader titleKey="admin.approve.refusedTitle" />
              {/* Safety first, exactly as `refuseRestrictionApproval` orders
                  them: a `stop` on a nursery is not "fetch a second approver",
                  and saying so would send someone to fetch one. */}
              <p>
                {t(
                  request.permitted
                    ? 'restriction.reject.selfApproval'
                    : 'restriction.reject.healthSensitiveStop',
                )}
              </p>
            </section>
          )}

          {decidable && request.requiresManagementSignOff ? (
            <section className={styles.section}>
              <SectionHeader titleKey="admin.approve.signOffTitle" />
              <Textfield
                id="approve-signoff"
                labelKey="admin.approve.signOffLabel"
                helperKey="admin.approve.signOffHelper"
                value={signedOffBy}
                onChange={setSignedOffBy}
              />
            </section>
          ) : null}

          <section className={styles.section}>
            <SectionHeader titleKey="admin.approve.declineTitle" />
            <p className={styles.meta}>{t('admin.approve.declineReasonLabel')}</p>
            <div className={styles.choices}>
              {DECLINE_REASONS.map((reason) => (
                <Button
                  key={reason}
                  variant={declineReason === reason ? 'primary' : 'ghost'}
                  pressed={declineReason === reason}
                  onClick={() => {
                    setDeclineReason(reason);
                  }}
                >
                  {t(reason)}
                </Button>
              ))}
            </div>
          </section>

          {refusal ? (
            <p className={gate.rejected} role="alert">
              {t(refusal)}
            </p>
          ) : null}

          <div className={styles.choices}>
            {decidable ? (
              <Button
                variant="primary"
                onClick={() => {
                  decide('approve');
                }}
              >
                {t('admin.approve.approve')}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                decide('decline');
              }}
            >
              {t('admin.approve.decline')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
