/**
 * NoticeList — the notices sent about an account, with what happened to each
 * one on each channel.
 *
 * It was a deck of cards on `client.billing` and the same deck again on
 * `admin.restriction-case`: a title, a provenance chip and one paragraph per
 * channel, so three notices became twelve paragraphs. The fields repeat, so
 * the shape is rows.
 *
 * Where a notice leads somewhere, the whole row is the link. A resident who
 * is told their cooling is restricted has to be able to open the notice that
 * said so (INV-NO-DEAD-END); the admin's copy of the same list is evidence,
 * and evidence does not navigate.
 *
 * @requirement FR-52
 */
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ProvenanceChip } from '../components/ProvenanceChip.tsx';
import { SeverityIndicator } from '../components/SeverityIndicator.tsx';
import type { Notice, NoticeListProps } from '../components/contracts.ts';
import styles from './NoticeList.module.css';

function Row({ notice }: { notice: Notice }) {
  const { t } = useTranslation();

  return (
    <>
      <SeverityIndicator severity={notice.severity} />
      <span className={styles.body}>
        <span className={styles.title}>{t(notice.titleKey)}</span>
        <ProvenanceChip provenance={notice.provenance} />
        <span className={styles.delivery}>
          {notice.delivery.map((item) => {
            return (
              <span key={`${item.channel}-${item.at}`} className={styles.channel}>
                {t('client.alerts.deliveryLine', {
                  channel: t(`alertDelivery.channel.${item.channel}`),
                  state: t(`alertDelivery.state.${item.state}`),
                })}
              </span>
            );
          })}
        </span>
      </span>
    </>
  );
}

export function NoticeList({ notices, hrefFor, hintKey }: NoticeListProps) {
  const { t } = useTranslation();

  return (
    <ul className={styles.notices}>
      {notices.map((notice) => {
        return (
          <li key={notice.id}>
            {hrefFor ? (
              <Link className={styles.row} to={hrefFor(notice)}>
                <Row notice={notice} />
                {hintKey ? <span className={styles.hint}>{t(hintKey)}</span> : null}
              </Link>
            ) : (
              <div className={styles.row}>
                <Row notice={notice} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
