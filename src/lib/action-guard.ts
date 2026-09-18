import "server-only";
import { can, type Permission } from "@/domain/rbac";
import { ERRORS } from "@/domain/result";
import { ActionFailure } from "@/domain/run-action";
import { getVerifiedSession, type SessionUser } from "@/lib/session";

/** Verifies the session and the role's permission, or throws an ActionFailure that `runAction` turns into a result. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await getVerifiedSession();
  if (!session.success || !session.data) {
    throw new ActionFailure(session.error ?? ERRORS.UNAUTHENTICATED);
  }
  if (!can(session.data.role, permission)) throw new ActionFailure(ERRORS.FORBIDDEN);
  return session.data;
}
