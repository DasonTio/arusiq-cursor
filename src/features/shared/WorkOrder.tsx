/**
 * shared.work-order — one record, three role addresses.
 *
 * Brief · Evidence · Checklist · Findings · Closure. A technician records;
 * telemetry settles. Third-party scope is enforced on the object, not the UI.
 *
 * @requirement FR-25 FR-32 FR-34
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { LOAD_STATE, type LoadState } from '../../lib/domain/loadState.ts';
import type { Role } from '../../lib/domain/role.ts';
import {
  REFERENCE_NOW,
  links,
  simulatedTelemetry,
  type ChecklistItem,
  type FindingVerdict,
  type WorkOrder as WorkOrderRecord,
  type WorkOrderOutcome,
} from '../../lib/simulation/index.ts';
import { DataTable } from '../../patterns/DataTable.tsx';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { useSession } from '../auth/session.ts';
import styles from './WorkOrder.module.css';

const VIEWS = ['brief', 'evidence', 'checklist', 'findings', 'closure'] as const;
/** The three results a check can be recorded as, in the order they are
 *  offered. `notRecorded` is a state, not a choice, so it is not here. */
const CHECK_RESULTS = ['pass', 'fail', 'notApplicable'] as const;
const VERDICTS: readonly FindingVerdict[] = [
  'confirmed',
  'notConfirmed',
  'sensorFault',
  'dataQualityIssue',
];
const OUTCOMES: readonly Exclude<WorkOrderOutcome, 'escalated'>[] = [
  'repaired',
  'noFaultFound',
];

type View = (typeof VIEWS)[number];

const asView = (raw: string | null): View =>
  VIEWS.includes(raw as View) ? (raw as View) : 'brief';

const listHrefFor = (role: Role): string => {
  if (role === 'client') return '/account/service';
  if (role === 'admin') return '/service';
  return '/work';
};

const isTechnician = (role: Role): boolean => {
  return role === 'technician-internal' || role === 'technician-thirdparty';
};

const canEdit = (role: Role, userId: string, order: WorkOrderRecord): boolean => {
  if (!isTechnician(role)) return false;
  if (order.assignedTo?.id !== userId) return false;
  return (
    order.state !== 'closed' &&
    order.state !== 'escalated' &&
    order.state !== 'awaitingVerification'
  );
};

export default function WorkOrder() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const eventId = params.get('event');
  const view = asView(params.get('view'));
  const [state, setState] = useState(LOAD_STATE[0] as LoadState);
  const [order, setOrder] = useState(null as WorkOrderRecord | null);
  const [retry, setRetry] = useState(0);
  const [refusal, setRefusal] = useState(null as string | null);
  const [draftVerdict, setDraftVerdict] = useState('confirmed' as FindingVerdict);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      return () => {
        cancelled = true;
      };
    }
    const scope = { role: session.role, userId: session.userId };
    const load = async () => {
      if (orderId) return simulatedTelemetry.getWorkOrder(scope, orderId);
      if (eventId) {
        const listed = await simulatedTelemetry.listWorkOrders(scope);
        const match = listed.find((item) => {
          return item.action.href.includes(eventId);
        });
        if (!match) return null;
        return simulatedTelemetry.getWorkOrder(scope, match.id);
      }
      return null;
    };
    void load()
      .then((next) => {
        if (cancelled) return;
        setOrder(next);
        setState(next ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [session, orderId, eventId, retry]);

  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value);
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  if (!session) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('shared.work-order.title')}</h1>
        <p className={styles.stateBody}>{t('shared.work-order.error')}</p>
      </section>
    );
  }

  const listHref = listHrefFor(session.role);

  if (state === 'empty' || (!orderId && !eventId)) {
    return (
      <section className={styles.state}>
        <h1 className={styles.stateTitle}>{t('shared.work-order.title')}</h1>
        <p className={styles.stateBody}>{t('shared.work-order.empty')}</p>
        <Button variant="primary" to={listHref}>
          {t('shared.work-order.emptyAction')}
        </Button>
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <p>{t('shared.work-order.loading')}</p>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  if (state === 'error' || !order) {
    return (
      <section className={styles.state} role="alert">
        <h1 className={styles.stateTitle}>{t('shared.work-order.title')}</h1>
        <p className={styles.stateBody}>{t('shared.work-order.error')}</p>
        <Button
          variant="primary"
          onClick={() => {
            setState(LOAD_STATE[0]);
            setRetry((n) => n + 1);
          }}
        >
          {t('shared.work-order.retry')}
        </Button>
      </section>
    );
  }

  const hrefFor = (next: View) => {
    const base = links.workOrder(session.role, order.id, order.maintenanceEventId);
    const join = base.includes('?') ? '&' : '?';
    return `${base}${join}view=${next}`;
  };
  const editable = canEdit(session.role, session.userId, order);
  const apply = (
    result: { ok: true; order: WorkOrderRecord } | { ok: false; reasonKey: string },
  ) => {
    if (result.ok) {
      setOrder(result.order);
      setRefusal(null);
      return;
    }
    setRefusal(result.reasonKey);
  };

  const recordItem = (
    item: ChecklistItem,
    result: 'pass' | 'fail' | 'notApplicable',
  ) => {
    void simulatedTelemetry
      .recordChecklistItem(
        { role: session.role, userId: session.userId },
        order.id,
        item.id,
        {
          result,
          photoLabelKeys: item.photoRequired ? [`workOrder.photo.${item.partId}`] : [],
        },
      )
      .then(apply);
  };

  const recordFinding = () => {
    void simulatedTelemetry
      .recordFinding({ role: session.role, userId: session.userId }, order.id, {
        partId: order.scope.partId ?? null,
        verdict: draftVerdict,
        noteKey: `workOrder.finding.${draftVerdict}.note`,
      })
      .then(apply);
  };

  const closeOrder = (outcome: Exclude<WorkOrderOutcome, 'escalated'>) => {
    void simulatedTelemetry
      .closeWorkOrder({ role: session.role, userId: session.userId }, order.id, {
        outcome,
        summaryKey: `workOrder.closure.${outcome}.summary`,
        requestClientConfirmation: true,
      })
      .then(apply);
  };

  const escalate = () => {
    void simulatedTelemetry
      .escalateWorkOrder({ role: session.role, userId: session.userId }, order.id, {
        reasonKey: 'workOrder.escalation.specialistRequired',
      })
      .then(apply);
  };

  const verify = () => {
    void simulatedTelemetry
      .runPostServiceCheck({ role: session.role, userId: session.userId }, order.id)
      .then(apply);
  };

  return (
    <div className={styles.root}>
      <Button variant="ghost" to={listHref}>
        {t('shared.work-order.back')}
      </Button>
      <PageHeader titleKey={order.titleKey} context={order.id}>
        <SeverityIndicator
          severity={order.severity}
          suspected={order.brief.suspected}
        />
      </PageHeader>
      {/* Five one-line paragraphs stacked down the page cost ~300px before a
          technician reached the tabs they came for. The same five fields are
          a labelled strip: one row, scannable, and the labels say what each
          value IS rather than leaving "Urgent" floating on its own line. */}
      <dl className={styles.metaStrip}>
        {order.unitName ? (
          <div>
            <dt className={styles.metaLabel}>{t('shared.work-order.metaSpace')}</dt>
            <dd className={styles.metaValue}>{order.unitName}</dd>
          </div>
        ) : null}
        <div>
          <dt className={styles.metaLabel}>{t('shared.work-order.metaState')}</dt>
          <dd className={styles.metaValue}>{t(`workOrder.state.${order.state}`)}</dd>
        </div>
        <div>
          <dt className={styles.metaLabel}>{t('shared.work-order.metaPriority')}</dt>
          <dd className={styles.metaValue}>
            {t(`workOrder.priority.${order.priority}`)}
          </dd>
        </div>
        <div>
          <dt className={styles.metaLabel}>{t('shared.work-order.metaAssignee')}</dt>
          {/* Unassigned is STATED, never blank — INV-NO-FABRICATION. */}
          <dd className={styles.metaValue}>
            {order.assignedTo
              ? order.assignedTo.name
              : t('shared.work-order.unassigned')}
          </dd>
        </div>
        <div>
          <dt className={styles.metaLabel}>{t('shared.work-order.metaSla')}</dt>
          <dd className={styles.metaValue}>{formatDateTime(order.slaDueAt)}</dd>
        </div>
      </dl>
      <ProvenanceChip provenance={order.provenance} />

      {order.brief.suspected ? (
        <p className={styles.banner} role="status">
          {t('shared.work-order.suspectedBanner')}
        </p>
      ) : null}

      {refusal ? (
        <p className={styles.banner} role="alert">
          {t(refusal)}
        </p>
      ) : null}

      <nav className={styles.views} aria-label={t('shell.views')}>
        {VIEWS.map((item) => {
          return (
            <Button
              key={item}
              variant={view === item ? 'primary' : 'ghost'}
              current={view === item}
              to={hrefFor(item)}
            >
              {t(`shared.work-order.${item}`)}
            </Button>
          );
        })}
      </nav>

      {view === 'brief' ? (
        <BriefView
          order={order}
          editable={editable}
          checklistHref={hrefFor('checklist')}
          format={format}
          formatDateTime={formatDateTime}
          role={session.role}
        />
      ) : null}

      {view === 'evidence' ? (
        <EvidenceView order={order} format={format} formatDateTime={formatDateTime} />
      ) : null}

      {view === 'checklist' ? (
        <section className={styles.section}>
          {order.checklist.map((group) => {
            return (
              <div key={group.group} className={styles.section}>
                <h2 className={styles.sectionTitle}>{t(group.labelKey)}</h2>
                <p className={styles.meta}>
                  {t('shared.work-order.checklistTally', {
                    recorded: format(group.recorded),
                    total: format(group.total),
                    failed: format(group.failed),
                  })}
                </p>
                {group.items.length === 0 ? (
                  <p className={styles.meta}>
                    {t('shared.work-order.noUnitChecklist')}
                  </p>
                ) : (
                  /* Twelve checks, each with the same five fields and a
                     three-button verdict group, drawn as twelve full-width
                     cards: 3,169 px to record a visit. The fields repeat, so
                     it is a table (§3) — and the verdict group stays, because
                     three buttons that record a result are a control, not a
                     button on a card. */
                  <DataTable
                    captionKey="shared.work-order.checklistCaption"
                    captionValues={{ group: t(group.labelKey) }}
                    rows={group.items}
                    rowKey={(item) => item.id}
                    columns={[
                      {
                        key: 'check',
                        labelKey: 'shared.work-order.colCheck',
                        rowHeader: true,
                        cell: (item) => t(item.labelKey),
                      },
                      {
                        key: 'reading',
                        labelKey: 'shared.work-order.colReading',
                        numeric: true,
                        cell: (item) =>
                          item.measurement ? (
                            <Metric
                              compact
                              labelKey={item.measurement.signalKey}
                              value={item.measurement.observed?.value ?? null}
                              unit={item.measurement.unit}
                              provenance={
                                item.measurement.observed?.provenance ??
                                item.measurement.limit.provenance
                              }
                              lastSeen={item.measurement.observed?.lastSeen ?? null}
                            />
                          ) : (
                            t('workOrder.result.notApplicable')
                          ),
                      },
                      {
                        key: 'limit',
                        labelKey: 'shared.work-order.limit',
                        numeric: true,
                        cell: (item) =>
                          item.measurement ? (
                            <Metric
                              compact
                              labelKey="shared.work-order.limit"
                              value={item.measurement.limit.value}
                              unit={item.measurement.unit}
                              provenance={item.measurement.limit.provenance}
                              lastSeen={item.measurement.limit.lastSeen}
                            />
                          ) : (
                            t('workOrder.result.notApplicable')
                          ),
                      },
                      {
                        key: 'evidence',
                        labelKey: 'shared.work-order.colEvidence',
                        cell: (item) => (
                          <span className={styles.evidenceCell}>
                            {item.noteKey ? <span>{t(item.noteKey)}</span> : null}
                            {item.photos.map((photo) => (
                              <span key={photo.id} className={styles.metaInline}>
                                {t('shared.work-order.photoCaption', {
                                  label: t(photo.labelKey),
                                  time: formatDateTime(photo.takenAt),
                                })}
                              </span>
                            ))}
                          </span>
                        ),
                      },
                      {
                        key: 'result',
                        labelKey: 'shared.work-order.colResult',
                        nowrap: true,
                        cell: (item) =>
                          editable ? (
                            /* The recorded result is the PRESSED button, not
                               a separate word beside three that all look the
                               same — which is what the row did, so a failed
                               check and a passed one were identical until you
                               read the far right of the card. */
                            <span className={styles.verdicts}>
                              {CHECK_RESULTS.map((result) => (
                                <Button
                                  key={result}
                                  variant={item.result === result ? 'primary' : 'ghost'}
                                  pressed={item.result === result}
                                  onClick={() => {
                                    recordItem(item, result);
                                  }}
                                >
                                  {t(`workOrder.result.${result}`)}
                                </Button>
                              ))}
                            </span>
                          ) : (
                            t(`workOrder.result.${item.result}`)
                          ),
                      },
                    ]}
                  />
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      {view === 'findings' ? (
        <section className={styles.section}>
          {order.findings.length === 0 ? (
            <p>{t('shared.work-order.noFindings')}</p>
          ) : (
            <ul className={styles.parts}>
              {order.findings.map((finding) => {
                return (
                  <li key={finding.id} className={styles.card}>
                    <p className={styles.cardTitle}>
                      {t(`workOrder.verdict.${finding.verdict}`)}
                    </p>
                    <p>{t(finding.noteKey)}</p>
                    {finding.downgradesAlert ? (
                      <p className={styles.meta}>{t('shared.work-order.downgraded')}</p>
                    ) : null}
                    {finding.partsUsed.map((part) => {
                      return (
                        <p key={part.sku} className={styles.meta}>
                          {t('shared.work-order.partUsed', {
                            label: t(part.labelKey),
                            quantity: format(part.quantity),
                          })}
                        </p>
                      );
                    })}
                    <time dateTime={finding.recordedAt}>
                      {formatDateTime(finding.recordedAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
          {editable ? (
            <div className={styles.card}>
              <p>{t('shared.work-order.recordFinding')}</p>
              <div className={styles.choices}>
                {VERDICTS.map((verdict) => {
                  return (
                    <Button
                      key={verdict}
                      variant={draftVerdict === verdict ? 'primary' : 'ghost'}
                      pressed={draftVerdict === verdict}
                      onClick={() => {
                        setDraftVerdict(verdict);
                      }}
                    >
                      {t(`workOrder.verdict.${verdict}`)}
                    </Button>
                  );
                })}
              </div>
              <Button variant="primary" onClick={recordFinding}>
                {t('shared.work-order.saveFinding')}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === 'closure' ? (
        <section className={styles.section}>
          {order.closure ? (
            <>
              <p>{t(order.closure.summaryKey)}</p>
              <p className={styles.meta}>
                {t(`workOrder.outcome.${order.closure.outcome}`)}
              </p>
              {order.closure.escalationReasonKey ? (
                <p>{t(order.closure.escalationReasonKey)}</p>
              ) : null}
              <p className={styles.meta}>
                {t(
                  `workOrder.clientConfirmation.${order.closure.clientConfirmation.state}`,
                )}
              </p>
              {order.closure.noVerificationReasonKey ? (
                <p className={styles.meta}>
                  {t(order.closure.noVerificationReasonKey)}
                </p>
              ) : null}
            </>
          ) : (
            <p>{t('shared.work-order.noClosure')}</p>
          )}
          {order.verification ? (
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>
                {t('shared.work-order.verification')}
              </h2>
              <p>{t(`workOrder.verificationState.${order.verification.state}`)}</p>
              <p>{t(order.verification.noteKey)}</p>
              <Metric
                labelKey="shared.work-order.before"
                value={order.verification.before.value}
                unit={order.verification.unit}
                provenance={order.verification.before.provenance}
                lastSeen={order.verification.before.lastSeen}
              />
              <Metric
                labelKey="shared.work-order.after"
                value={order.verification.after?.value ?? null}
                unit={order.verification.unit}
                provenance={
                  order.verification.after?.provenance ??
                  order.verification.before.provenance
                }
                lastSeen={order.verification.after?.lastSeen ?? null}
              />
              <Metric
                labelKey="shared.work-order.limit"
                value={order.verification.limit.value}
                unit={order.verification.unit}
                provenance={order.verification.limit.provenance}
                lastSeen={order.verification.limit.lastSeen}
              />
            </div>
          ) : null}
          {editable ? (
            <div className={styles.choices}>
              {OUTCOMES.map((outcome) => {
                return (
                  <Button
                    key={outcome}
                    variant="secondary"
                    onClick={() => {
                      closeOrder(outcome);
                    }}
                  >
                    {t(`workOrder.outcome.${outcome}`)}
                  </Button>
                );
              })}
              <Button variant="ghost" onClick={escalate}>
                {t('workOrder.outcome.escalated')}
              </Button>
            </div>
          ) : null}
          {order.state === 'awaitingVerification' && session.role !== 'client' ? (
            <Button variant="primary" onClick={verify}>
              {t('shared.work-order.runCheck')}
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function BriefView({
  order,
  editable,
  checklistHref,
  format,
  formatDateTime,
  role,
}: {
  order: WorkOrderRecord;
  editable: boolean;
  checklistHref: string;
  format: (value: number) => string;
  formatDateTime: (iso: string) => string;
  role: Role;
}) {
  const { t } = useTranslation();
  const { confidence, signals, raisedAt } = order.evidence;
  const confidencePct = confidence === null ? null : Math.round(confidence * 100);
  // A CSS length, not display text — the percentage the reader actually sees is
  // rendered through t() below. Hoisted out of the JSX so the marker stays on
  // the line directly above the one it covers, however Prettier wraps the tag.
  // i18n-exempt
  const confidenceFill = `${confidencePct ?? 0}%`;
  const daysObserved = raisedAt
    ? Math.round(
        (new Date(REFERENCE_NOW).getTime() - new Date(raisedAt).getTime()) / 86_400_000,
      )
    : null;

  const hasConsequences =
    order.brief.healthSensitive ||
    order.brief.restrictionStep !== null ||
    order.evidence.projection !== null;
  const alertHref = order.brief.alertId
    ? links.alertFor(role, order.brief.alertId)
    : null;
  const hasStartContent =
    editable ||
    order.brief.accessNoteKey !== null ||
    alertHref !== null ||
    order.scope.unitId !== null;

  return (
    <div className={styles.nowGrid}>
      <section className={styles.card} aria-labelledby="brief-suspected">
        <h2 className={styles.cardTitle} id="brief-suspected">
          {t('shared.work-order.suspectedCard')}
        </h2>
        <p>{t(order.brief.summaryKey)}</p>
        <p className={styles.meta}>{t(`workOrder.origin.${order.brief.origin}`)}</p>
        {confidencePct === null ? (
          <p className={styles.meta}>{t('shared.work-order.noPrediction')}</p>
        ) : (
          <>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuenow={confidencePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('shared.work-order.confidence', {
                value: format(confidencePct),
              })}
            >
              <div
                className={styles.progressFill}
                style={{ inlineSize: confidenceFill }}
              />
            </div>
            <p className={styles.meta}>
              {daysObserved === null
                ? t('shared.work-order.confidenceSignals', {
                    value: format(confidencePct),
                    signals: format(signals.length),
                  })
                : t('shared.work-order.confidenceDetail', {
                    value: format(confidencePct),
                    signals: format(signals.length),
                    days: format(daysObserved),
                  })}
            </p>
          </>
        )}
        {order.brief.suspected ? (
          <p className={styles.meta}>{t('shared.work-order.suspectedBanner')}</p>
        ) : null}
      </section>

      {hasConsequences ? (
        <section className={styles.card} aria-labelledby="brief-ignored">
          <h2 className={styles.cardTitle} id="brief-ignored">
            {t('shared.work-order.ifIgnoredCard')}
          </h2>
          {order.brief.healthSensitive ? (
            <p className={styles.meta}>{t('shared.work-order.healthSensitive')}</p>
          ) : null}
          {order.brief.restrictionStep ? (
            <p className={styles.meta}>
              {t(`restriction.${order.brief.restrictionStep}`)}
            </p>
          ) : null}
          {order.evidence.projection ? (
            <p className={styles.meta}>
              {t('shared.work-order.projection', {
                by: formatDateTime(order.evidence.projection.failureBy),
                earliest: formatDateTime(
                  order.evidence.projection.confidenceBand.earliest,
                ),
                latest: formatDateTime(order.evidence.projection.confidenceBand.latest),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      {hasStartContent ? (
        <section className={styles.card} aria-labelledby="brief-start">
          <h2 className={styles.cardTitle} id="brief-start">
            {t('shared.work-order.startCard')}
          </h2>
          {order.brief.accessNoteKey ? <p>{t(order.brief.accessNoteKey)}</p> : null}
          {editable ? (
            <Button variant="primary" to={checklistHref}>
              {t('shared.work-order.startAction')}
            </Button>
          ) : null}
          {alertHref ? (
            <Button variant="secondary" to={alertHref}>
              {t('shared.work-order.openAlert')}
            </Button>
          ) : null}
          {order.scope.unitId ? (
            <Button variant="ghost" to={links.unit(order.scope.unitId)}>
              {t('shared.work-order.openUnit')}
            </Button>
          ) : null}
        </section>
      ) : null}

      <section className={styles.card} aria-labelledby="brief-device">
        <h2 className={styles.cardTitle} id="brief-device">
          {t('shared.work-order.deviceStateCard')}
        </h2>
        <p>
          {order.evidence.dataQuality.reporting
            ? t('shared.work-order.reporting')
            : t('shared.work-order.notReporting')}
        </p>
        {order.evidence.dataQuality.lastSeen ? (
          <p className={styles.meta}>
            {t('loadState.lastSeen', {
              time: formatDateTime(order.evidence.dataQuality.lastSeen),
            })}
          </p>
        ) : null}
        <p className={styles.meta}>{t(order.evidence.dataQuality.noteKey)}</p>
      </section>
    </div>
  );
}

function EvidenceView({
  order,
  format,
  formatDateTime,
}: {
  order: WorkOrderRecord;
  format: (value: number) => string;
  formatDateTime: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const quality = order.evidence.dataQuality;
  return (
    <section className={styles.section}>
      <p>{t(quality.noteKey)}</p>
      {quality.lastSeen ? (
        <p className={styles.meta}>
          {t('loadState.lastSeen', { time: formatDateTime(quality.lastSeen) })}
        </p>
      ) : null}
      {order.evidence.confidence === null ? (
        <p className={styles.meta}>{t('shared.work-order.noPrediction')}</p>
      ) : (
        <p className={styles.meta}>
          {t('shared.work-order.confidence', {
            value: format(order.evidence.confidence * 100),
          })}
        </p>
      )}
      {order.evidence.partGroups.map((group) => {
        return (
          <p key={group} className={styles.meta}>
            {t(`partGroup.${group}`)}
          </p>
        );
      })}
      {order.evidence.signals.map((signal) => {
        return (
          <div key={signal.signalKey} className={styles.metrics}>
            <Metric
              labelKey={signal.signalKey}
              value={signal.observed.value}
              unit={signal.unit}
              provenance={signal.observed.provenance}
              lastSeen={signal.observed.lastSeen}
            />
            <Metric
              labelKey="shared.work-order.limit"
              value={signal.threshold.value}
              unit={signal.unit}
              provenance={signal.threshold.provenance}
              lastSeen={signal.threshold.lastSeen}
            />
          </div>
        );
      })}
      {order.evidence.projection ? (
        <p className={styles.meta}>
          {t('shared.work-order.projection', {
            by: formatDateTime(order.evidence.projection.failureBy),
            earliest: formatDateTime(order.evidence.projection.confidenceBand.earliest),
            latest: formatDateTime(order.evidence.projection.confidenceBand.latest),
          })}
        </p>
      ) : null}
      <ProvenanceChip provenance={order.evidence.provenance} />
    </section>
  );
}
