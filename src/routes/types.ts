/**
 * Route contract.
 *
 * D5 UR-SYS-05 / UR-TEC-02 / D6 FR-34 — role scoping is enforced in
 * NAVIGATION, not only in data (D7 §18.2). Third-party technicians see assigned
 * work only.
 *
 * `allowedRoles` is required on every route. If it were optional, the default
 * would be "everyone", and D5 acceptance principle 5 — prove scoping by
 * attempting unauthorised navigation as each role — would be untestable.
 *
 * @requirement FR-34
 */
import type { ComponentType } from 'react';

export const ROLES = [
  'client', 'technician-internal', 'technician-thirdparty', 'admin',
] as const;
export type Role = (typeof ROLES)[number];

export interface RouteEntry {
  /** Matches a `screens[].id` in context/requirements/requirements.json. */
  screenId: string;
  path: string;
  component: ComponentType;
  /** Never optional. An empty array means nobody, not everybody. */
  allowedRoles: readonly Role[];
  /** Shown in the nav shell; omit for detail routes reached by drilling in. */
  navLabelKey?: string;
}

export const canAccess = (route: RouteEntry, role: Role): boolean =>
  route.allowedRoles.includes(role);
