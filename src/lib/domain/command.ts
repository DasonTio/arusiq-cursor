/**
 * Command lifecycle — "we asked" is not "the machine did it".
 *
 * D6 FR-40 / D7 §13.1 — a control command is not a toggle that flips. The
 * control stays in its previous position until the device reports back.
 *
 * @requirement FR-40
 */

export const COMMAND_STATE = [
  'sent',
  'acknowledged',
  'verified',
  'failed',
  'queued',
] as const;

export type CommandState = (typeof COMMAND_STATE)[number];

/** Only `verified` settles the control into its new position (D7 §13.1). */
export const isSettled = (s: CommandState): boolean =>
  s === 'verified' || s === 'failed';

/** `queued` means the device is unreachable and the command is held — shown
 *  explicitly with its queue time, never silently swallowed. */
export const isPending = (s: CommandState): boolean =>
  s === 'sent' || s === 'acknowledged' || s === 'queued';

/**
 * The pipeline a command walks (D7 §13.1). `failed` and `queued` are not rungs
 * of this pipeline: `failed` breaks it (we do not know how far the command
 * got, so the UI shows the break rather than guessing), and `queued` holds the
 * command before the first rung.
 */
export const COMMAND_FLOW = ['sent', 'acknowledged', 'verified'] as const;
export type CommandFlow = (typeof COMMAND_FLOW)[number];

export interface CommandStage {
  /** The furthest pipeline rung this command honestly reached. */
  reached: CommandFlow;
  /** A terminal hold that is not progression. */
  terminal: 'failed' | 'queued' | null;
}

export const commandStage = (s: CommandState): CommandStage => {
  if (s === 'failed') return { reached: 'sent', terminal: 'failed' };
  if (s === 'queued') return { reached: 'sent', terminal: 'queued' };
  return { reached: s, terminal: null };
};

/* --------------------------------------------------------- progression */

/**
 * How long each rung takes. The ORDER of the pipeline is a domain rule; the
 * durations are a simulation input (`SIMULATED_POLICY.commandTimings`), so
 * they arrive as an argument rather than living here as a constant everybody
 * would end up quoting as a requirement.
 */
export interface CommandTimings {
  acknowledgedAfterMs: number;
  verifiedAfterMs: number;
}

/** Position in the pipeline. `failed` and `queued` are not rungs of it. */
const rungIndex = (state: CommandFlow): number => COMMAND_FLOW.indexOf(state);

/**
 * The furthest rung a command issued `elapsedMs` ago has honestly reached.
 * A pure function of elapsed time, which is what lets a test assert every
 * stage without sleeping on the wall clock.
 */
export const commandStateAfter = (
  elapsedMs: number,
  timings: CommandTimings,
): CommandFlow => {
  if (elapsedMs >= timings.verifiedAfterMs) return 'verified';
  if (elapsedMs >= timings.acknowledgedAfterMs) return 'acknowledged';
  return 'sent';
};

/**
 * Move a command forward by elapsed time, never backwards.
 *
 * `failed` and `queued` are returned untouched on purpose. A failed command
 * did not get further just because time passed — D7 §13.1 wants the break
 * shown rather than a rung guessed — and a queued command is held at an
 * unreachable device, which cannot acknowledge anything.
 */
export const advanceCommand = (
  current: CommandState,
  elapsedMs: number,
  timings: CommandTimings,
): CommandState => {
  if (current === 'failed' || current === 'queued') return current;
  const byTime = commandStateAfter(elapsedMs, timings);
  return rungIndex(byTime) > rungIndex(current) ? byTime : current;
};

/**
 * One explicit rung forward. The seam a browser timer or a test drives when
 * it wants progression without moving a clock. Same guarantees as
 * `advanceCommand`: ordered, monotonic, and no rescue for a terminal state.
 */
export const nextCommandState = (current: CommandState): CommandState => {
  if (current === 'failed' || current === 'queued' || current === 'verified') {
    return current;
  }
  return COMMAND_FLOW[rungIndex(current) + 1] ?? current;
};
