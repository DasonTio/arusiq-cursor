/**
 * Application router. Role landing is resolved here (S-2), not inside each
 * dashboard, so an unauthorised deep link cannot paint someone else's page.
 *
 * @requirement FR-01 FR-04 FR-34
 */
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MockBoundary } from '../components/MockBoundary.tsx';
import { SessionProvider } from '../features/auth/SessionProvider.tsx';
import { useSession } from '../features/auth/session.ts';
import { LanguageSwitch } from '../features/shared/LanguageSwitch.tsx';
import { RoleShell } from '../features/shared/RoleShell.tsx';
import NotAvailable from '../features/shared/NotAvailable.tsx';
import { PUBLIC_ROUTES, PROTECTED_ROUTES } from './catalog.ts';
import { RequireAuth, RequireRole } from './guards.tsx';
import { landingPath } from './navigation.ts';
import styles from './AppRouter.module.css';

function LandingRedirect() {
  const { session } = useSession();
  if (!session) {
    return <Navigate to="/sign-in" replace />;
  } else {
    return <Navigate to={landingPath(session.role)} replace />;
  }
}

function PublicChrome({ children }: { children: ReactNode }) {
  return (
    <div className={styles.public}>
      <header className={styles.publicHeader}>
        {/* i18n-exempt — proper noun, identical in every locale */}
        <p className={styles.brand}>ARUSIQ</p>
        <LanguageSwitch />
      </header>
      <main className={styles.publicMain}>{children}</main>
    </div>
  );
}

export function AppRouter() {
  return (
    <SessionProvider>
      {/* The shell carries the viewport height (D7 §14.4's banner still sits
          at the top of it); the boundary itself only marks the mock. */}
      <div className={styles.shell}>
        <MockBoundary explanationKey="shell.mock">
          <BrowserRouter>
            <Routes>
              {PUBLIC_ROUTES.map((route) => {
                const Screen = route.component;
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <PublicChrome>
                        <Screen />
                      </PublicChrome>
                    }
                  />
                );
              })}
              <Route
                element={
                  <RequireAuth>
                    <RoleShell />
                  </RequireAuth>
                }
              >
                {PROTECTED_ROUTES.map((route) => {
                  const Screen = route.component;
                  return (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={
                        <RequireRole allowedRoles={route.allowedRoles}>
                          <Screen />
                        </RequireRole>
                      }
                    />
                  );
                })}
                <Route path="*" element={<NotAvailable />} />
              </Route>
              <Route path="/" element={<LandingRedirect />} />
            </Routes>
          </BrowserRouter>
        </MockBoundary>
      </div>
    </SessionProvider>
  );
}
