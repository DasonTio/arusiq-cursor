/**
 * shared.assign — local-only HQ assignment panel.
 *
 * @requirement FR-31 FR-34
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import {
  TECHNICIANS,
  type WorkOrderAssignee,
  type WorkOrderSummary,
} from '../../lib/simulation/index.ts';
import styles from './JourneyPanel.module.css';

const WINDOWS = ['morning', 'afternoon'] as const;
const SLA_CHOICES = ['keep', 'expedite'] as const;

export default function Assign({
  order,
  onAssigned,
}: {
  order: WorkOrderSummary;
  onAssigned: (assignee: WorkOrderAssignee) => void;
}) {
  const { t } = useTranslation();
  const [assignee, setAssignee] = useState(null as WorkOrderAssignee | null);
  const [window, setWindow] = useState(WINDOWS[0] as (typeof WINDOWS)[number]);
  const [sla, setSla] = useState(SLA_CHOICES[0] as (typeof SLA_CHOICES)[number]);
  const [submitted, setSubmitted] = useState(false);

  const confirm = () => {
    if (!assignee) return;
    onAssigned(assignee);
    setSubmitted(true);
  };

  return (
    <div className={styles.root}>
      <Button variant="ghost" to="/service">
        {t('shared.assign.back')}
      </Button>
      <header className={styles.intro}>
        <h1>{t('shared.assign.title')}</h1>
        <p>{t('shared.assign.purpose')}</p>
      </header>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{t(order.titleKey)}</h2>
        <p className={styles.meta}>{order.id}</p>
        {order.unitName ? <p className={styles.meta}>{order.unitName}</p> : null}
        <p>{t('shared.assign.unassigned')}</p>
      </section>

      <fieldset className={styles.fieldset}>
        <legend>{t('shared.assign.technician')}</legend>
        <div className={styles.choices}>
          {TECHNICIANS.map((candidate) => {
            const next = candidate as WorkOrderAssignee;
            return (
              <Button
                key={candidate.id}
                variant={assignee?.id === candidate.id ? 'primary' : 'secondary'}
                pressed={assignee?.id === candidate.id}
                onClick={() => setAssignee(next)}
              >
                {candidate.name}
              </Button>
            );
          })}
        </div>
      </fieldset>

      {assignee?.role === 'technician-thirdparty' ? (
        <p className={styles.meta}>{t('shared.assign.thirdParty')}</p>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend>{t('shared.assign.window')}</legend>
        <div className={styles.choices}>
          {WINDOWS.map((value) => (
            <Button
              key={value}
              variant={window === value ? 'primary' : 'secondary'}
              pressed={window === value}
              onClick={() => setWindow(value)}
            >
              {t(`shared.assign.windowValue.${value}`)}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>{t('shared.assign.sla')}</legend>
        <div className={styles.choices}>
          {SLA_CHOICES.map((value) => (
            <Button
              key={value}
              variant={sla === value ? 'primary' : 'secondary'}
              pressed={sla === value}
              onClick={() => setSla(value)}
            >
              {t(`shared.assign.slaValue.${value}`)}
            </Button>
          ))}
        </div>
      </fieldset>

      <MockBoundary explanationKey="shared.assign.notificationMock">
        <p className={styles.meta}>{t('shared.assign.notificationBody')}</p>
      </MockBoundary>

      {submitted && assignee ? (
        <section className={styles.confirmation} role="status">
          <p>{t('shared.assign.submitted', { name: assignee.name })}</p>
          <Button variant="primary" to="/service">
            {t('shared.assign.return')}
          </Button>
        </section>
      ) : (
        <Button variant="primary" disabled={!assignee} onClick={confirm}>
          {t('shared.assign.confirm')}
        </Button>
      )}
    </div>
  );
}
