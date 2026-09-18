import "server-only";
import { getServerSession } from "next-auth";
import type { Role } from "@/domain/enums";
import { ERRORS, fail, ok, type ActionResult } from "@/domain/result";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface SessionUser {
  id: string;
  role: Role;
}

/**
 * The only way Server Actions learn who is calling. Identity comes from the signed
 * session cookie, and the user is re-read from the DB so deleted users are rejected
 * and role changes apply immediately instead of waiting for the JWT to expire.
 */
export async function getVerifiedSession(): Promise<ActionResult<SessionUser>> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return fail(ERRORS.UNAUTHENTICATED);

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) return fail(ERRORS.UNAUTHENTICATED);

  return ok({ id: user.id, role: user.role });
}
