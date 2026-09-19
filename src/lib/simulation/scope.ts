/**
 * Who may see what.
 *
 * D6 FR-34 / INV-SCOPE — "scope third-party technicians to assigned work
 * orders ONLY". Scoping is applied to the DATA, not left to a screen to filter
 * after the fact: a list the caller was never given cannot be rendered by
 * mistake, and a roll-up cannot summarise units the caller may not see.
 *
 * That last point is the subtle one. A pruned tree whose roll-ups were still
 * computed over the whole property would leak the property's condition to a
 * contractor holding one work order, so the roll-ups are recomputed over the
 * visible units here.
 *
 * @requirement FR-34
 */
import { countAtOrAbove, rollUp } from '../domain/severity.ts';
import type { Severity } from '../domain/severity.ts';
import { ACCESS } from './fixtures.ts';
import type { SimDataset } from './build.ts';
import type {
  DataScope,
  Floor,
  Property,
  RestrictionRequest,
  Room,
  WorkOrder,
} from './types.ts';

/** Every unit id the caller may see, by role. */
export const visibleUnitIds = (dataset: SimDataset, scope: DataScope): Set<string> => {
  if (scope.role === 'admin') {
    return new Set(dataset.index.unitById.keys());
  }

  if (scope.role === 'client') {
    const owned = Object.entries(ACCESS.propertyOwner)
      .filter(([, ownerId]) => ownerId === scope.userId)
      .map(([propertyId]) => propertyId);
    return new Set(owned.flatMap((id) => dataset.index.unitIdsByAsset.get(id) ?? []));
  }

  const assigned = ACCESS.assignedUnits[scope.userId] ?? [];

  // A third-party contractor sees the units on their work orders and nothing
  // around them. Widening to the property would be the exact failure FR-34
  // names, so there is deliberately no branch here that does it.
  if (scope.role === 'technician-thirdparty') return new Set(assigned);

  // An internal technician is dispatched to a site and needs the site: they
  // see whole properties where they hold at least one assignment. This is a
  // wider scope than the third party has, and that difference is the point.
  const sites = new Set<string>();
  for (const [propertyId, unitIds] of dataset.index.unitIdsByAsset) {
    if (!dataset.index.propertyById.has(propertyId)) continue;
    if (unitIds.some((id) => assigned.includes(id))) sites.add(propertyId);
  }
  return new Set(
    [...sites].flatMap((id) => dataset.index.unitIdsByAsset.get(id) ?? []),
  );
};

const nodeRollUp = (severities: Severity[]) => ({
  severity: rollUp(severities),
  contributing: countAtOrAbove(severities, 'unknown'),
  total: severities.length,
});

/** Rebuilds a property containing only visible units, with roll-ups
 *  recomputed over exactly those units. */
const prune = (property: Property, visible: Set<string>): Property | null => {
  const floors = property.floors
    .map((floor): Floor | null => {
      const rooms = floor.rooms
        .map((room): Room | null => {
          const units = room.units.filter((u) => visible.has(u.id));
          if (units.length === 0) return null;
          return {
            ...room,
            units,
            rollUp: nodeRollUp(units.map((u) => u.rollUp.severity)),
          };
        })
        .filter((r): r is Room => r !== null);
      if (rooms.length === 0) return null;
      const severities = rooms.flatMap((r) => r.units.map((u) => u.rollUp.severity));
      return { ...floor, rooms, rollUp: nodeRollUp(severities) };
    })
    .filter((f): f is Floor => f !== null);

  if (floors.length === 0) return null;
  const severities = floors.flatMap((f) =>
    f.rooms.flatMap((r) => r.units.map((u) => u.rollUp.severity)),
  );
  return { ...property, floors, rollUp: nodeRollUp(severities) };
};

export const scopedProperties = (dataset: SimDataset, scope: DataScope): Property[] => {
  const visible = visibleUnitIds(dataset, scope);
  return dataset.properties
    .map((p) => prune(p, visible))
    .filter((p): p is Property => p !== null);
};

export const canSeeUnit = (
  dataset: SimDataset,
  scope: DataScope,
  unitId: string,
): boolean => visibleUnitIds(dataset, scope).has(unitId);

/** True when every unit beneath `assetId` is visible to the caller. Used to
 *  refuse an aggregate that would otherwise be computed over hidden units. */
export const canSeeAsset = (
  dataset: SimDataset,
  scope: DataScope,
  assetId: string,
): boolean => {
  const unitIds = dataset.index.unitIdsByAsset.get(assetId) ?? [];
  if (unitIds.length === 0) return false;
  const visible = visibleUnitIds(dataset, scope);
  return unitIds.every((id) => visible.has(id));
};

/**
 * D6 FR-34 — "scope third-party technicians to assigned work orders ONLY",
 * enforced on the OBJECT rather than on the menu (D2 O-WO). A contractor holds
 * the orders bearing their name and nothing adjacent to them, which is why
 * this branch has no fallback to the site: the fallback is the bug.
 *
 * An internal technician is dispatched to a site and sees the site's orders.
 * A client sees the orders on the properties they own, at every stage — an
 * order that becomes invisible the moment it is escalated is how a visit goes
 * quiet on the person waiting for it.
 */
export const canSeeWorkOrder = (
  dataset: SimDataset,
  scope: DataScope,
  order: WorkOrder,
): boolean => {
  if (scope.role === 'admin') return true;
  if (scope.role === 'technician-thirdparty')
    return order.assignedTo?.id === scope.userId;
  if (scope.role === 'technician-internal') {
    if (order.assignedTo?.id === scope.userId) return true;
    const visible = visibleUnitIds(dataset, scope);
    return order.scope.unitId
      ? visible.has(order.scope.unitId)
      : (dataset.index.unitIdsByAsset.get(order.scope.propertyId) ?? []).some((id) =>
          visible.has(id),
        );
  }
  return ACCESS.propertyOwner[order.scope.propertyId] === scope.userId;
};

/**
 * D6 FR-52 / ADR-0015 — the restriction approval queue is HQ's.
 *
 * Scoped on the OBJECT, like `canSeeWorkOrder` above, rather than by hiding a
 * menu item: a client who guesses a request id has to get the same answer a
 * request that does not exist gives them.
 *
 * Written as role AND scope rather than as a bare role check, so that the
 * Phase 1B regional admin — who sees a subset of properties — narrows here and
 * nowhere else. Today `scopedProperties` returns everything for an admin, so
 * the second clause costs nothing and documents the seam.
 */
export const canSeeRestrictionRequest = (
  dataset: SimDataset,
  scope: DataScope,
  request: RestrictionRequest,
): boolean =>
  scope.role === 'admin' &&
  scopedProperties(dataset, scope).some((p) => p.id === request.scope.propertyId);

/**
 * The property a client's Home screen is about. A Phase 1A client owns exactly
 * one; if that changes, C-1 needs a property switcher and this returns the
 * chosen one rather than the first.
 */
export const primaryPropertyId = (
  dataset: SimDataset,
  scope: DataScope,
): string | null => {
  if (scope.role !== 'client') return null;
  const owned = dataset.properties.find(
    (p) => ACCESS.propertyOwner[p.id] === scope.userId,
  );
  return owned?.id ?? null;
};
