/**
 * Simulated sign-in. Phase 1B replaces this with a real identity provider;
 * the screens keep calling `authenticate`.
 *
 * Lockout after five failures uses the same wording whether the identifier
 * exists or not (D2 S-1). The word "credit" never appears here.
 *
 * @requirement FR-01
 */
import type { Role } from '../domain/role.ts';

export const LOCKOUT_AFTER = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export interface DemoAccount {
  id: string;
  identifiers: readonly string[];
  password: string;
  role: Role;
  name: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: 'user-client',
    identifiers: ['client@arusiq.demo', '08110000001'],
    password: 'demo',
    role: 'client',
    name: 'Sari Wijaya',
  },
  {
    id: 'user-tech',
    identifiers: ['tech@arusiq.demo', '08110000002'],
    password: 'demo',
    role: 'technician-internal',
    name: 'Budi Pratama',
  },
  {
    id: 'user-partner',
    identifiers: ['partner@arusiq.demo', '08110000003'],
    password: 'demo',
    role: 'technician-thirdparty',
    name: 'Dewi Lestari',
  },
  {
    id: 'user-admin',
    identifiers: ['hq@arusiq.demo', '08110000004'],
    password: 'demo',
    role: 'admin',
    name: 'Andi Nugroho',
  },
];

export interface LockState {
  failures: number;
  until: number | null;
}

export type AuthResult =
  | { ok: true; account: DemoAccount; lock: LockState }
  | { ok: false; reason: 'invalid'; lock: LockState }
  | { ok: false; reason: 'locked'; lock: LockState };

const emptyLock = (): LockState => ({ failures: 0, until: null });

const normalise = (identifier: string): string => identifier.trim().toLowerCase();

export const findDemoAccount = (identifier: string): DemoAccount | undefined => {
  const key = normalise(identifier);
  return DEMO_ACCOUNTS.find((account) =>
    account.identifiers.some((id) => id.toLowerCase() === key),
  );
};

export const accountForRole = (role: Role): DemoAccount => {
  const found = DEMO_ACCOUNTS.find((account) => account.role === role);
  if (!found) throw new Error(`No demo account for role ${role}`);
  return found;
};

export function authenticate(
  identifier: string,
  password: string,
  now: number,
  previous: LockState | null,
): AuthResult {
  const lock = previous ?? emptyLock();

  if (lock.until !== null && now < lock.until) {
    return { ok: false, reason: 'locked', lock };
  }

  const resetLock = lock.until !== null && now >= lock.until ? emptyLock() : lock;
  const account = findDemoAccount(identifier);
  const matches = Boolean(account && account.password === password);

  if (matches && account) {
    return { ok: true, account, lock: emptyLock() };
  }

  const failures = resetLock.failures + 1;
  const next: LockState =
    failures >= LOCKOUT_AFTER
      ? { failures, until: now + LOCKOUT_MS }
      : { failures, until: null };

  if (next.until !== null) {
    return { ok: false, reason: 'locked', lock: next };
  }
  return { ok: false, reason: 'invalid', lock: next };
}
