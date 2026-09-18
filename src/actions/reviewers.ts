"use server";

import type { UserRefDTO } from "@/domain/dto";
import { ok, type ActionResult } from "@/domain/result";
import { runAction } from "@/domain/run-action";
import { requirePermission } from "@/lib/action-guard";
import { prisma } from "@/lib/db";

export async function listReviewers(): Promise<ActionResult<UserRefDTO[]>> {
  return runAction(async () => {
    await requirePermission("VIEW");
    const reviewers = await prisma.user.findMany({
      where: { role: "REVIEWER" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    return ok(reviewers);
  });
}
