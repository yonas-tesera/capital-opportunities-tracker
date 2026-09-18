import "server-only";
import type { Prisma } from "@prisma/client";
import { ERRORS } from "@/domain/result";
import { ActionFailure } from "@/domain/run-action";

export async function findOpportunityForWrite(tx: Prisma.TransactionClient, id: string) {
  const row = await tx.opportunity.findUnique({
    where: { id },
    select: {
      id: true,
      stage: true,
      isArchived: true,
      assignedReviewer: { select: { id: true, name: true } },
    },
  });
  if (!row) throw new ActionFailure(ERRORS.NOT_FOUND);
  return row;
}

export function assertNotArchived(row: { isArchived: boolean }): void {
  if (row.isArchived) throw new ActionFailure(ERRORS.ARCHIVED);
}

/** Guarded writes use `updateMany` with the state they read; zero matches means a concurrent change won. */
export function assertUpdated(result: { count: number }): void {
  if (result.count !== 1) throw new ActionFailure(ERRORS.CONFLICT);
}
