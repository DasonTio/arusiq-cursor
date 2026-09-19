/**
 * Session for the Phase 1A prototype. Persistence is local to the browser;
 * there is no backend.
 *
 * @requirement FR-01 FR-02 FR-34
 */
import { useMemo, useState, type ReactNode } from 'react';
import { accountForRole, authenticate } from '../../lib/simulation/auth.ts';
import {
  SESSION_KEY,
  SessionContext,
  readLocks,
  readSession,
  toSession,
  writeLocks,
  type Session,
  type SessionContextValue,
} from './session.ts';

export function SessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  /** Pass `null` in tests to force a signed-out start; omit to read storage. */
  initialSession?: Session | null;
}) {
  const [session, setSession] = useState<Session | null>(() =>
    initialSession !== undefined ? initialSession : readSession(),
  );

  const persist = (next: Session | null): void => {
    setSession(next);
    if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SESSION_KEY);
  };

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      signIn(identifier, password) {
        const key = identifier.trim().toLowerCase();
        const locks = readLocks();
        const result = authenticate(
          identifier,
          password,
          Date.now(),
          locks[key] ?? null,
        );
        locks[key] = result.lock;
        writeLocks(locks);
        if (result.ok) {
          persist(toSession(result.account));
          return { ok: true };
        }
        return {
          ok: false,
          reason: result.reason,
          until: result.lock.until,
        };
      },
      signInDemo(role) {
        persist(toSession(accountForRole(role)));
      },
      signOut() {
        persist(null);
      },
      switchRole(role) {
        const current = session;
        const account = accountForRole(role);
        persist({
          userId: current?.userId ?? account.id,
          role,
          name: current?.name ?? account.name,
        });
      },
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
