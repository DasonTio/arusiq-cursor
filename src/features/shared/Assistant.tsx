/**
 * shared.assistant — mocked text assistant. Voice is a labelled mock.
 * Nothing runs until the reader confirms.
 *
 * @requirement FR-04
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button.tsx';
import { MockBoundary } from '../../components/MockBoundary.tsx';
import { Textfield } from '../../components/Textfield.tsx';
import { useSession } from '../auth/session.ts';
import { LanguageSwitch } from './LanguageSwitch.tsx';
import styles from './Screen.module.css';

export default function Assistant() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState([] as string[]);
  const [pending, setPending] = useState(false);

  const actionTo =
    session?.role === 'client'
      ? '/alerts'
      : session?.role === 'admin'
        ? '/overview/events'
        : '/work';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    setLines((prev) => [...prev, draft.trim(), t('shared.assistant.reply')]);
    setDraft('');
    setPending(true);
  }

  return (
    <div className={styles.root}>
      <header className={styles.intro}>
        <h1>{t('shared.assistant.title')}</h1>
        <p>{t('shared.assistant.purpose')}</p>
      </header>
      <LanguageSwitch />
      <MockBoundary explanationKey="shared.assistant.mock">
        <p className={styles.meta}>{t('shared.assistant.voiceMock')}</p>
        <Button
          variant="ghost"
          onClick={() => {
            setLines((prev) => [...prev, t('shared.assistant.voice')]);
          }}
        >
          {t('shared.assistant.voice')}
        </Button>
        <ul className={styles.list}>
          {lines.map((line, index) => {
            return (
              <li key={`${index}-${line}`} className={styles.card}>
                <p>{line}</p>
              </li>
            );
          })}
        </ul>
        <form onSubmit={onSubmit} className={styles.section}>
          <Textfield
            id="assistant-prompt"
            labelKey="shared.assistant.prompt"
            value={draft}
            onChange={setDraft}
          />
          <Button variant="primary" type="submit">
            {t('shared.assistant.send')}
          </Button>
        </form>
        {pending ? (
          <div className={styles.choices}>
            <Button
              variant="primary"
              to={actionTo}
              onClick={() => {
                setPending(false);
              }}
            >
              {t('shared.assistant.confirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(false);
              }}
            >
              {t('shared.assistant.cancel')}
            </Button>
          </div>
        ) : null}
      </MockBoundary>
    </div>
  );
}
