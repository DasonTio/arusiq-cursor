/**
 * Walk the asset tree. Selectors and tests share these so nobody re-implements
 * a flatten that forgets a floor.
 *
 * @requirement FR-10 FR-34
 */
import type { Floor, Property, Room, Unit } from './types.ts';

export const walkUnits = (properties: readonly Property[]): Unit[] =>
  properties.flatMap((p) => p.floors.flatMap((f) => f.rooms.flatMap((r) => r.units)));

export const walkRooms = (
  properties: readonly Property[],
): { property: Property; floor: Floor; room: Room }[] =>
  properties.flatMap((property) =>
    property.floors.flatMap((floor) =>
      floor.rooms.map((room) => ({ property, floor, room })),
    ),
  );
