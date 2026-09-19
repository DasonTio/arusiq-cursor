/**
 * Route guard. Unauthenticated visitors go to sign-in. A role that is not
 * on `allowedRoles` sees NotAvailable, not an empty foreign dashboard.
 *
 * @requirement FR-34
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '../lib/domain/role.ts';
import { useSession } from '../features/auth/session.ts';
import NotAvailable from '../features/shared/NotAvailable.tsx';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: readonly Role[];
  children: ReactNode;
}) {
  const { session } = useSession();

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <NotAvailable />;
  }

  return children;
}
