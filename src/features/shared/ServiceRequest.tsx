/**
 * shared.service-request — alert-prefilled, explicitly simulated request.
 *
 * @requirement FR-31 FR-32
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { ProvenanceChip } from '../../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import {
  simulatedTelemetry,
  walkUnits,
  type Alert,
  type Property,
  type Unit,
} from '../../lib/simulation/index.ts';
import { useSession } from '../auth/session.ts';
import styles from './JourneyPanel.module.css';

const VISIT_TYPES = ['inspection', 'repair', 'filter'] as const;
const SLOT_KEYS = ['morning', 'afternoon', 'flexible'] as const;
const CONTACT_KEYS = ['whatsapp', 'phone', 'email'] as const;

export default function ServiceRequest() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [params] = useSearchParams();
  const alertId = params.get('alert');
  const [alert, setAlert] = useState(null as Alert | null);
  const [unit, setUnit] = useState(null as Unit | null);
  const [failed, setFailed] = useState(false);
  const [visitType, setVisitType] = useState(
    VISIT_TYPES[1] as (typeof VISIT_TYPES)[number],
  );
  const [slot, setSlot] = useState(SLOT_KEYS[0] as (typeof SLOT_KEYS)[number]);
  const [contact, setContact] = useState(
    CONTACT_KEYS[0] as (typeof CONTACT_KEYS)[number],
  );
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!session || !alertId) return;
    const scope = { role: session.role, userId: session.userId };
    void Promise.all([
      simulatedTelemetry.listAlerts(scope),
      simulatedTelemetry.listProperties(scope),
    ])
      .then(([alerts, properties]: [Alert[], Property[]]) => {
        const nextAlert = alerts.find((candidate) => candidate.id === alertId) ?? null;
        const nextUnit =
          walkUnits(properties).find(
            (candidate) => candidate.id === nextAlert?.scope.unitId,
          ) ?? null;
        setAlert(nextAlert);
        setUnit(nextUnit);
      })
      .catch(() => setFailed(true));
  }, [alertId, session]);

  if (failed || (!alertId && !alert)) {
    return (
      <section className={styles.state} role="alert">
        <h1>{t('shared.serviceRequest.title')}</h1>
        <p>{t('shared.serviceRequest.error')}</p>
        <Button variant="primary" to="/alerts">
          {t('shared.serviceRequest.back')}
        </Button>
      </section>
    );
  }

  if (!alert || !unit) {
    return <p aria-busy="true">{t('shared.serviceRequest.loading')}</p>;
  }

  return (
    <div className={styles.root}>
      <Button variant="ghost" to="/alerts">
        {t('shared.serviceRequest.back')}
      </Button>
      <header className={styles.intro}>
        <h1>{t('shared.serviceRequest.title')}</h1>
        <p>{t('shared.serviceRequest.purpose')}</p>
      </header>
      <section className={styles.card}>
        <div className={styles.cardTop}>
          <h2 className={styles.cardTitle}>{t(alert.titleKey)}</h2>
          <SeverityIndicator severity={alert.severity} suspected={alert.suspected} />
        </div>
        <p className={styles.meta}>{unit.name}</p>
        <ProvenanceChip provenance={alert.provenance} />
      </section>

      <ChoiceGroup
        title={t('shared.serviceRequest.visitType')}
        values={VISIT_TYPES}
        selected={visitType}
        label={(value) => t(`shared.serviceRequest.type.${value}`)}
        select={setVisitType}
      />
      <ChoiceGroup
        title={t('shared.serviceRequest.slot')}
        values={SLOT_KEYS}
        selected={slot}
        label={(value) => t(`shared.serviceRequest.slotValue.${value}`)}
        select={setSlot}
      />
      <ChoiceGroup
        title={t('shared.serviceRequest.contact')}
        values={CONTACT_KEYS}
        selected={contact}
        label={(value) => t(`shared.serviceRequest.contactValue.${value}`)}
        select={setContact}
      />

      <MockBoundary explanationKey="shared.serviceRequest.photoMock">
        <p className={styles.meta}>{t('shared.serviceRequest.photoBody')}</p>
      </MockBoundary>

      {submitted ? (
        <section className={styles.confirmation} role="status">
          <p>{t('shared.serviceRequest.submitted')}</p>
          <Button variant="primary" to="/account/service">
            {t('shared.serviceRequest.track')}
          </Button>
        </section>
      ) : (
        <Button variant="primary" onClick={() => setSubmitted(true)}>
          {t('shared.serviceRequest.submit')}
        </Button>
      )}
    </div>
  );
}

function ChoiceGroup<T extends string>({
  title,
  values,
  selected,
  label,
  select,
}: {
  title: string;
  values: readonly T[];
  selected: T;
  label: (value: T) => string;
  select: (value: T) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{title}</legend>
      <div className={styles.choices}>
        {values.map((value) => (
          <Button
            key={value}
            variant={selected === value ? 'primary' : 'secondary'}
            pressed={selected === value}
            onClick={() => select(value)}
          >
            {label(value)}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
