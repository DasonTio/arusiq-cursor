/**
 * Every href the adapter hands to a screen, in one place.
 *
 * INV-NO-DEAD-END — an alert leads to an action and a roll-up can be opened,
 * which means the data layer emits links, not just ids. Centralising them here
 * means the day a node route exists (`/spaces/:nodeId` rather than a query
 * parameter) is a change to this file, not a sweep of the simulator.
 *
 * Paths are the ones declared in `src/routes/catalog.ts`. Nothing here invents
 * a route that does not resolve.
 *
 * @requirement FR-10 FR-32
 */
import type { Role } from '../domain/role.ts';

export const links = {
  node: (nodeId: string): string => `/spaces?node=${encodeURIComponent(nodeId)}`,
  unit: (unitId: string): string => `/spaces?node=${encodeURIComponent(unitId)}`,
  alert: (alertId: string): string => `/alerts?alert=${encodeURIComponent(alertId)}`,
  alerts: (): string => '/alerts',
  billing: (): string => '/account',
  service: (eventId?: string): string =>
    eventId
      ? `/account/service?event=${encodeURIComponent(eventId)}`
      : '/account/service',
  /** D6 FR-30 — a service request PREFILLED from the alert that prompted it. */
  serviceRequest: (alertId: string): string =>
    `/account/service?request=new&alert=${encodeURIComponent(alertId)}`,
  /**
   * D2 O-WO — one record, three addresses. The client tracks it in Account →
   * Service, the technician performs it from the work queue and HQ dispatches
   * it from the board; all three are routes that already resolve in
   * `src/routes/catalog.ts`. Sending every role to one of them would hand a
   * client a link that lands on "not available for your role".
   */
  workOrder: (
    role: Role,
    workOrderId: string,
    maintenanceEventId?: string | null,
  ): string => {
    const id = encodeURIComponent(workOrderId);
    if (role === 'client') {
      return maintenanceEventId
        ? `/account/service?event=${encodeURIComponent(maintenanceEventId)}`
        : '/account/service';
    }
    return role === 'admin' ? `/service?order=${id}` : `/work?order=${id}`;
  },
  /**
   * D2 — "go see service work for this" from a shared object (`shared.unit`'s
   * History view, opened by every role). The client has one screen combining
   * history and new requests (`links.service()`). Admin and technician have
   * no per-unit equivalent; the closest real, non-fabricated destination is
   * their own fleet-wide service screen (the board, the queue) — a genuine
   * allowed page, not a dead end, even though it is not unit-scoped the way
   * the client's is.
   */
  serviceFor: (role: Role): string => {
    if (role === 'client') return '/account/service';
    return role === 'admin' ? '/service' : '/work';
  },
  /**
   * D2 — `shared.work-order`'s own "open the alert that raised this" action,
   * from an object every role opens. Admin has a real destination
   * (`admin.alerts` reads the same `?alert=` param as the client route).
   * Technician has no alert-detail screen at all in this build — `null`
   * means "the caller should omit the button", not "guess a route"; sending
   * a technician to `/alerts` (client-only) or inventing a path that does
   * not resolve in `src/routes/catalog.ts` is exactly the dead end this
   * function exists to prevent.
   */
  alertFor: (role: Role, alertId: string): string | null => {
    if (role === 'client') return `/alerts?alert=${encodeURIComponent(alertId)}`;
    if (role === 'admin')
      return `/overview/events?alert=${encodeURIComponent(alertId)}`;
    return null;
  },
  energy: (): string => '/insights',
  carbon: (): string => '/insights/carbon',
  /** D6 FR-61 — "the chart is not permitted without a link to the method". */
  method: (methodId: string): string =>
    `/insights?method=${encodeURIComponent(methodId)}`,
};
