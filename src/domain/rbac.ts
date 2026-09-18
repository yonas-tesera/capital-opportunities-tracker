import type { Role } from "./enums";
import { ERRORS, fail, type ActionResult } from "./result";

export const PERMISSIONS = {
  VIEW: ["ADMIN", "REVIEWER", "VIEWER"],
  CREATE: ["ADMIN"],
  EDIT: ["ADMIN"],
  ASSIGN_REVIEWER: ["ADMIN"],
  CHANGE_STAGE: ["ADMIN", "REVIEWER"],
  ADD_COMMENT: ["ADMIN", "REVIEWER", "VIEWER"],
  ARCHIVE: ["ADMIN"],
  RESTORE: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Returns a FORBIDDEN result when the role lacks the permission, otherwise null. */
export function denyUnless(role: Role, permission: Permission): ActionResult<never> | null {
  return can(role, permission) ? null : fail(ERRORS.FORBIDDEN);
}
