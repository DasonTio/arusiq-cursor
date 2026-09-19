/**
 * Every reachable screen. `allowedRoles` is required — an omitted list would
 * default to everyone and make FR-34 untestable.
 *
 * @requirement FR-34
 */
import type { RouteEntry } from './types.ts';
import SignIn from '../features/auth/SignIn.tsx';
import ForgotPassword from '../features/auth/ForgotPassword.tsx';
import Overview from '../features/client/Overview.tsx';
import Spaces from '../features/client/Spaces.tsx';
import Alerts from '../features/client/Alerts.tsx';
import Energy from '../features/client/Energy.tsx';
import Carbon from '../features/client/Carbon.tsx';
import Billing from '../features/client/Billing.tsx';
import Maintenance from '../features/client/Maintenance.tsx';
import Queue from '../features/technician/Queue.tsx';
import Map from '../features/technician/Map.tsx';
import Me from '../features/technician/Me.tsx';
import AdminOverview from '../features/admin/Overview.tsx';
import AdminAlerts from '../features/admin/Alerts.tsx';
import Fleet from '../features/admin/Fleet.tsx';
import Dispatch from '../features/admin/Dispatch.tsx';
import Payments from '../features/admin/Payments.tsx';
import RestrictionCase from '../features/admin/RestrictionCase.tsx';
import Approve from '../features/admin/Approve.tsx';
import EnergyPortfolio from '../features/admin/EnergyPortfolio.tsx';
import Mrv from '../features/admin/Mrv.tsx';
import Settings from '../features/admin/Settings.tsx';
import Audit from '../features/admin/Audit.tsx';
import Profile from '../features/shared/Profile.tsx';
import Search from '../features/shared/Search.tsx';
import Assistant from '../features/shared/Assistant.tsx';

const TECH: RouteEntry['allowedRoles'] = [
  'technician-internal',
  'technician-thirdparty',
];
const ALL: RouteEntry['allowedRoles'] = [
  'client',
  'technician-internal',
  'technician-thirdparty',
  'admin',
];

export const PUBLIC_ROUTES: readonly RouteEntry[] = [
  {
    screenId: 'auth.sign-in',
    path: '/sign-in',
    component: SignIn,
    allowedRoles: [],
  },
  {
    screenId: 'auth.forgot-password',
    path: '/forgot-password',
    component: ForgotPassword,
    allowedRoles: [],
  },
];

export const PROTECTED_ROUTES: readonly RouteEntry[] = [
  {
    screenId: 'client.overview',
    path: '/home',
    component: Overview,
    allowedRoles: ['client'],
    navLabelKey: 'nav.client.home',
  },
  {
    screenId: 'client.spaces',
    path: '/spaces',
    component: Spaces,
    allowedRoles: ['client'],
    navLabelKey: 'nav.client.spaces',
  },
  {
    screenId: 'client.alerts',
    path: '/alerts',
    component: Alerts,
    allowedRoles: ['client'],
    navLabelKey: 'nav.client.alerts',
  },
  {
    screenId: 'client.energy',
    path: '/insights',
    component: Energy,
    allowedRoles: ['client'],
    navLabelKey: 'nav.client.insights',
  },
  {
    screenId: 'client.carbon',
    path: '/insights/carbon',
    component: Carbon,
    allowedRoles: ['client'],
  },
  {
    screenId: 'client.billing',
    path: '/account',
    component: Billing,
    allowedRoles: ['client'],
    navLabelKey: 'nav.client.account',
  },
  {
    screenId: 'client.maintenance',
    path: '/account/service',
    component: Maintenance,
    allowedRoles: ['client'],
  },
  {
    screenId: 'shared.profile',
    path: '/account/profile',
    component: Profile,
    allowedRoles: ['client'],
  },
  {
    screenId: 'shared.profile',
    path: '/profile',
    component: Profile,
    allowedRoles: ALL,
  },
  {
    screenId: 'shared.search',
    path: '/search',
    component: Search,
    allowedRoles: ALL,
  },
  {
    screenId: 'shared.assistant',
    path: '/assistant',
    component: Assistant,
    allowedRoles: ALL,
  },
  {
    screenId: 'tech.queue',
    path: '/work',
    component: Queue,
    allowedRoles: TECH,
    navLabelKey: 'nav.tech.work',
  },
  {
    screenId: 'tech.map',
    path: '/map',
    component: Map,
    allowedRoles: TECH,
    navLabelKey: 'nav.tech.map',
  },
  {
    screenId: 'tech.me',
    path: '/me',
    component: Me,
    allowedRoles: TECH,
    navLabelKey: 'nav.tech.me',
  },
  {
    screenId: 'admin.overview',
    path: '/overview',
    component: AdminOverview,
    allowedRoles: ['admin'],
    navLabelKey: 'nav.admin.overview',
  },
  {
    screenId: 'admin.alerts',
    path: '/overview/events',
    component: AdminAlerts,
    allowedRoles: ['admin'],
  },
  {
    screenId: 'admin.fleet',
    path: '/fleet',
    component: Fleet,
    allowedRoles: ['admin'],
    navLabelKey: 'nav.admin.fleet',
  },
  {
    screenId: 'admin.dispatch',
    path: '/service',
    component: Dispatch,
    allowedRoles: ['admin'],
    navLabelKey: 'nav.admin.service',
  },
  {
    screenId: 'admin.payments',
    path: '/accounts',
    component: Payments,
    allowedRoles: ['admin'],
    navLabelKey: 'nav.admin.accounts',
  },
  {
    // The restriction-case object (FR-52): the ladder, its timer, the
    // decision record and the notices — reached from Payments and from
    // the Overview's restrictions group.
    screenId: 'admin.restriction-case',
    path: '/accounts/case',
    component: RestrictionCase,
    allowedRoles: ['admin'],
  },
  {
    // P-APPROVE (FR-52/FR-53): the gate on the ladder. Phone-capable — it is
    // one of the three HQ actions ADR-0008 keeps working at 375. No `?request`
    // shows the pending queue; with one it is the decision panel.
    screenId: 'shared.approve',
    path: '/accounts/approve',
    component: Approve,
    allowedRoles: ['admin'],
  },
  {
    screenId: 'admin.energy-portfolio',
    path: '/reporting',
    component: EnergyPortfolio,
    allowedRoles: ['admin'],
    navLabelKey: 'nav.admin.reporting',
  },
  {
    screenId: 'admin.mrv',
    path: '/reporting/packages',
    component: Mrv,
    allowedRoles: ['admin'],
  },
  {
    screenId: 'admin.settings',
    path: '/settings',
    component: Settings,
    allowedRoles: ['admin'],
  },
  {
    screenId: 'admin.audit',
    path: '/audit',
    component: Audit,
    allowedRoles: ['admin'],
  },
];

export const ROUTES: readonly RouteEntry[] = [...PUBLIC_ROUTES, ...PROTECTED_ROUTES];
