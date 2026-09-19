/**
 * Labelled text field. Helper and error are separate treatments — an error
 * must not replace the label, and a placeholder must not replace either.
 */
import type { TextfieldProps } from './contracts.ts';
import { useTranslation } from 'react-i18next';
import styles from './Textfield.module.css';

export function Textfield({
  id,
  labelKey,
  value,
  onChange,
  type = 'text',
  autoComplete,
  helperKey,
  errorKey,
  disabled,
}: TextfieldProps) {
  const { t } = useTranslation();
  const helperId = helperKey ? `${id}-helper` : undefined;
  const errorId = errorKey ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={id}>
        {t(labelKey)}
      </label>
      <input
        id={id}
        className={styles.input}
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={errorKey ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperKey ? (
        <p id={helperId} className={styles.helper}>
          {t(helperKey)}
        </p>
      ) : null}
      {errorKey ? (
        <p id={errorId} className={styles.error} role="alert">
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}
