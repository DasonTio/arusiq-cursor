/**
 * Product roles. Navigation scoping is enforced against this union
 * (D5 UR-SYS-05 / D6 FR-34), not only against filtered data.
 *
 * @requirement FR-34
 */
export const ROLES = [
  'client',
  'technician-internal',
  'technician-thirdparty',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

export const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);
