/**
 * Command lifecycle — "we asked" is not "the machine did it".
 *
 * D6 FR-40 / D7 §13.1 — a control command is not a toggle that flips. The
 * control stays in its previous position until the device reports back.
 *
 * @requirement FR-40
 */

export const COMMAND_STATE = [
  'sent', 'acknowledged', 'verified', 'failed', 'queued',
] as const;

export type CommandState = (typeof COMMAND_STATE)[number];

/** Only `verified` settles the control into its new position (D7 §13.1). */
export const isSettled = (s: CommandState): boolean =>
  s === 'verified' || s === 'failed';

/** `queued` means the device is unreachable and the command is held — shown
 *  explicitly with its queue time, never silently swallowed. */
export const isPending = (s: CommandState): boolean =>
  s === 'sent' || s === 'acknowledged' || s === 'queued';
