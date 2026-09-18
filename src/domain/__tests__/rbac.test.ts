import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "../enums";
import { can, denyUnless, PERMISSIONS, type Permission } from "../rbac";
import { isError } from "../result";

const MATRIX: Record<Permission, readonly Role[]> = {
  VIEW: ["ADMIN", "REVIEWER", "VIEWER"],
  CREATE: ["ADMIN"],
  EDIT: ["ADMIN"],
  ASSIGN_REVIEWER: ["ADMIN"],
  CHANGE_STAGE: ["ADMIN", "REVIEWER"],
  ADD_COMMENT: ["ADMIN", "REVIEWER", "VIEWER"],
  ARCHIVE: ["ADMIN"],
  RESTORE: ["ADMIN"],
};

const cases = (Object.keys(MATRIX) as Permission[]).flatMap((permission) =>
  ROLES.map((role) => [role, permission, MATRIX[permission].includes(role)] as const),
);

describe("rbac", () => {
  it("covers exactly the documented permissions", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  it.each(cases)("%s / %s -> %s", (role, permission, allowed) => {
    expect(can(role, permission)).toBe(allowed);
    const denied = denyUnless(role, permission);
    if (allowed) expect(denied).toBeNull();
    else expect(denied && isError(denied, "FORBIDDEN")).toBe(true);
  });
});
