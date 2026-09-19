/**
 * Destination rails from D2 v2.1 / ADR-0008. Presentation (tabs vs labelled
 * sidebar) is the shell's job (ADR-0010); this file only names what each role
 * can open.
 *
 * @requirement FR-34 FR-04
 */
import type { Role } from '../lib/domain/role.ts';

export interface NavItem {
  id: string;
  path: string;
  labelKey: string;
  /** Prefix match for nested views. Home-like items set this false. */
  prefix?: boolean;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: readonly NavItem[];
}

export const CLIENT_NAV: readonly NavItem[] = [
  { id: 'home', path: '/home', labelKey: 'nav.client.home' },
  { id: 'spaces', path: '/spaces', labelKey: 'nav.client.spaces' },
  { id: 'alerts', path: '/alerts', labelKey: 'nav.client.alerts' },
  { id: 'insights', path: '/insights', labelKey: 'nav.client.insights', prefix: true },
  { id: 'account', path: '/account', labelKey: 'nav.client.account', prefix: true },
];

export const TECH_NAV: readonly NavItem[] = [
  { id: 'work', path: '/work', labelKey: 'nav.tech.work', prefix: true },
  { id: 'map', path: '/map', labelKey: 'nav.tech.map' },
  { id: 'me', path: '/me', labelKey: 'nav.tech.me', prefix: true },
];

export const ADMIN_NAV: readonly NavSection[] = [
  {
    id: 'overview',
    labelKey: 'nav.admin.overview',
    items: [
      { id: 'decisions', path: '/overview', labelKey: 'nav.admin.decisions' },
      { id: 'events', path: '/overview/events', labelKey: 'nav.admin.events' },
    ],
  },
  {
    id: 'fleet',
    labelKey: 'nav.admin.fleet',
    items: [
      { id: 'explorer', path: '/fleet', labelKey: 'nav.admin.explorer', prefix: true },
    ],
  },
  {
    id: 'service',
    labelKey: 'nav.admin.service',
    items: [
      { id: 'board', path: '/service', labelKey: 'nav.admin.board', prefix: true },
    ],
  },
  {
    id: 'accounts',
    labelKey: 'nav.admin.accounts',
    items: [
      {
        id: 'payments',
        path: '/accounts',
        labelKey: 'nav.admin.payments',
        prefix: true,
      },
    ],
  },
  {
    id: 'reporting',
    labelKey: 'nav.admin.reporting',
    items: [
      { id: 'energy', path: '/reporting', labelKey: 'nav.admin.energy' },
      { id: 'packages', path: '/reporting/packages', labelKey: 'nav.admin.packages' },
    ],
  },
];

export function landingPath(role: Role): string {
  if (role === 'admin') return '/overview';
  if (role === 'client') return '/home';
  return '/work';
}

export function navForRole(role: Role): readonly NavItem[] | readonly NavSection[] {
  if (role === 'admin') return ADMIN_NAV;
  if (role === 'client') return CLIENT_NAV;
  return TECH_NAV;
}

/**
 * Whether `path` is one the role's own nav actually reaches. Used to guard a
 * cross-role redirect: signing out from a page leaves a router `from` state
 * behind (`RequireAuth`'s redirect), and a *different* role signing in next —
 * switching demo accounts — must not inherit a path that belonged to the role
 * that was just signed out (D6 FR-34, the same boundary `RequireRole`
 * enforces once you land — this just stops the redirect handing you a path
 * you're about to bounce off of).
 */
export function isNavReachable(path: string, role: Role): boolean {
  const items: readonly NavItem[] =
    role === 'admin'
      ? ADMIN_NAV.flatMap((section) => section.items)
      : (navForRole(role) as readonly NavItem[]);
  return items.some((item) =>
    item.prefix ? path.startsWith(item.path) : path === item.path,
  );
}

export const INSIGHT_VIEWS = [
  { to: '/insights', labelKey: 'nav.client.energy', end: true },
  { to: '/insights/carbon', labelKey: 'nav.client.carbon' },
] as const;

export const ACCOUNT_VIEWS = [
  { to: '/account', labelKey: 'nav.client.billing', end: true },
  { to: '/account/service', labelKey: 'nav.client.service' },
  { to: '/account/profile', labelKey: 'nav.client.profile' },
] as const;

export const ADMIN_OVERVIEW_VIEWS = [
  { to: '/overview', labelKey: 'nav.admin.decisions', end: true },
  { to: '/overview/events', labelKey: 'nav.admin.events' },
] as const;

export const ADMIN_REPORTING_VIEWS = [
  { to: '/reporting', labelKey: 'nav.admin.energy', end: true },
  { to: '/reporting/packages', labelKey: 'nav.admin.packages' },
] as const;
