/**
 * shared.space — room comfort and indoor-air object. Emissions never appear.
 *
 * @requirement FR-15 FR-63 FR-66
 */
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { Metric } from '../../components/Metric.tsx';
import { SeverityIndicator } from '../../components/SeverityIndicator.tsx';
import { SeverityRollUp } from '../../components/SeverityRollUp.tsx';
import {
  comfortLabelKey,
  comfortSeverity,
  comfortVerdict,
} from '../../lib/domain/comfort.ts';
import {
  SIMULATED_POLICY,
  asReading,
  isAbsent,
  type Floor,
  type MaybeReading,
  type Property,
  type Reading,
  type Room,
  type SensorKey,
} from '../../lib/simulation/index.ts';
import { PageHeader } from '../../patterns/PageHeader.tsx';
import { PriorityList } from '../../patterns/PriorityList.tsx';
import { SectionHeader } from '../../patterns/SectionHeader.tsx';
import styles from './Space.module.css';

export interface SpaceProps {
  property: Property;
  floor: Floor;
  room: Room;
  backTo: string;
  unitHref: (unitId: string) => string;
}

function channel(room: Room, key: SensorKey): Reading | null {
  const fitted = room.units
    .map((unit) => unit.live[key])
    .filter((reading): reading is MaybeReading => !isAbsent(reading))
    .map((reading) => asReading(reading))
    .filter((reading): reading is Reading => reading !== null);
  return fitted.find((reading) => reading.value !== null) ?? fitted[0] ?? null;
}

export default function Space({ property, floor, room, backTo, unitHref }: SpaceProps) {
  const { t } = useTranslation();
  const temperature = channel(room, 'temperatureC');
  const humidity = channel(room, 'humidityPct');
  const co2 = channel(room, 'co2Ppm');
  const pm25 = channel(room, 'pm25');
  const verdict = comfortVerdict(
    {
      temperatureC: temperature?.value ?? null,
      humidityPct: humidity?.value ?? null,
    },
    SIMULATED_POLICY.comfortEnvelope,
  );

  return (
    <div className={styles.root}>
      <Button variant="ghost" to={backTo}>
        {t('shared.space.back')}
      </Button>
      <PageHeader
        title={room.name}
        contextKey="shared.space.location"
        contextValues={{
          property: property.name,
          floor: floor.nameKey ? t(floor.nameKey) : floor.name,
        }}
      >
        <SeverityIndicator severity={room.rollUp.severity} />
      </PageHeader>

      <div className={styles.nowGrid}>
        <section className={styles.card} aria-labelledby="space-comfort">
          <h2 className={styles.cardTitle} id="space-comfort">
            {t('shared.space.comfortTitle')}
          </h2>
          <SeverityIndicator severity={comfortSeverity(verdict)} />
          <p>{t(comfortLabelKey(verdict))}</p>
          <div className={styles.metrics}>
            <Metric
              labelKey="sensor.temperatureC"
              value={temperature?.value ?? null}
              unit="°C"
              provenance={temperature?.provenance ?? 'simulated'}
              lastSeen={temperature?.lastSeen ?? null}
            />
            <Metric
              labelKey="sensor.humidityPct"
              value={humidity?.value ?? null}
              unit="%"
              provenance={humidity?.provenance ?? 'simulated'}
              lastSeen={humidity?.lastSeen ?? null}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="space-air">
          <h2 className={styles.cardTitle} id="space-air">
            {t('shared.space.airTitle')}
          </h2>
          <div className={styles.metrics}>
            {co2 ? (
              <Metric
                labelKey="sensor.co2Ppm"
                value={co2.value}
                unit="ppm"
                provenance={co2.provenance}
                lastSeen={co2.lastSeen}
              />
            ) : (
              <p className={styles.missing}>
                {t('shared.space.notFitted', { sensor: t('sensor.co2Ppm') })}
              </p>
            )}
            {pm25 ? (
              <Metric
                labelKey="sensor.pm25"
                value={pm25.value}
                unit="µg/m³"
                provenance={pm25.provenance}
                lastSeen={pm25.lastSeen}
              />
            ) : (
              <p className={styles.missing}>
                {t('shared.space.notFitted', { sensor: t('sensor.pm25') })}
              </p>
            )}
          </div>
          <p className={styles.meta}>{t('shared.space.ventilation')}</p>
        </section>
      </div>

      {room.healthSensitive ? (
        <section className={styles.notice}>
          <h2 className={styles.sectionTitle}>{t('shared.space.healthTitle')}</h2>
          <p>{t('shared.space.healthBody')}</p>
        </section>
      ) : null}

      <section className={styles.section}>
        <SeverityRollUp
          severity={room.rollUp.severity}
          contributing={room.rollUp.contributing}
          total={room.rollUp.total}
          href={backTo}
        />
        <SectionHeader titleKey="shared.space.equipmentTitle" />
        <PriorityList
          ariaLabelKey="shared.space.unitsTitle"
          groups={[
            {
              id: 'units',
              labelKey: 'shared.space.unitsTitle',
              items: room.units.map((unit) => ({
                id: unit.id,
                title: unit.name,
                severity: unit.rollUp.severity,
                to: unitHref(unit.id),
              })),
            },
          ]}
        />
      </section>
    </div>
  );
}
