/**
 * Session types and hook. The provider component lives in SessionProvider.tsx
 * so Fast Refresh can treat that file as components-only.
 *
 * @requirement FR-01 FR-02 FR-34
 */
import { createContext, useContext } from 'react';
import type { Role } from '../../lib/domain/role.ts';
import type { DemoAccount, LockState } from '../../lib/simulation/auth.ts';

export const SESSION_KEY = 'arusiq.session';
export const LOCK_KEY = 'arusiq.authLocks';

export interface Session {
  userId: string;
  role: Role;
  name: string;
}

export type SignInOutcome =
  { ok: true } | { ok: false; reason: 'invalid' | 'locked'; until: number | null };

export interface SessionContextValue {
  session: Session | null;
  signIn: (identifier: string, password: string) => SignInOutcome;
  signInDemo: (role: Role) => void;
  signOut: (scope: 'this' | 'all') => void;
  switchRole: (role: Role) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export const toSession = (account: DemoAccount): Session => ({
  userId: account.id,
  role: account.role,
  name: account.name,
});

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.userId || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readLocks(): Record<string, LockState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LockState>) : {};
  } catch {
    return {};
  }
}

export function writeLocks(locks: Record<string, LockState>): void {
  window.localStorage.setItem(LOCK_KEY, JSON.stringify(locks));
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
