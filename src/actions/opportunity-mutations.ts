"use server";

import type { Prisma } from "@prisma/client";
import type { OpportunityDetailDTO } from "@/domain/dto";
import { ERRORS, ok, type ActionResult } from "@/domain/result";
import { ActionFailure, runAction } from "@/domain/run-action";
import {
  archiveOpportunitySchema,
  assignReviewerSchema,
  changeStageSchema,
  createOpportunitySchema,
  restoreOpportunitySchema,
  updateOpportunitySchema,
} from "@/domain/schemas";
import { assertTransition } from "@/domain/state-machine";
import { requirePermission } from "@/lib/action-guard";
import { writeActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { assertNotArchived, assertUpdated, findOpportunityForWrite } from "@/lib/opportunity-guards";
import { loadOpportunityDetail } from "@/lib/opportunity-detail";

type Result = Promise<ActionResult<OpportunityDetailDTO>>;

async function requireDetail(tx: Prisma.TransactionClient, id: string): Promise<OpportunityDetailDTO> {
  const detail = await loadOpportunityDetail(tx, id);
  if (!detail) throw new ActionFailure(ERRORS.NOT_FOUND);
  return detail;
}

export async function createOpportunity(input: unknown): Result {
  return runAction(async () => {
    const actor = await requirePermission("CREATE");
    const data = createOpportunitySchema.parse(input);

    const detail = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: { ...data, stage: "DRAFT", createdById: actor.id },
        select: { id: true },
      });
      await writeActivity(tx, {
        opportunityId: created.id,
        actorId: actor.id,
        type: "CREATION",
        metadata: { stage: "DRAFT" },
      });
      return requireDetail(tx, created.id);
    });
    return ok(detail);
  });
}

export async function updateOpportunity(input: unknown): Result {
  return runAction(async () => {
    await requirePermission("EDIT");
    const { id, ...fields } = updateOpportunitySchema.parse(input);

    const detail = await prisma.$transaction(async (tx) => {
      assertNotArchived(await findOpportunityForWrite(tx, id));
      assertUpdated(await tx.opportunity.updateMany({ where: { id, isArchived: false }, data: fields }));
      return requireDetail(tx, id);
    });
    return ok(detail);
  });
}

/** Assumption: assigning or unassigning a reviewer counts as an edit, so it is blocked on archived opportunities. */
export async function assignReviewer(input: unknown): Result {
  return runAction(async () => {
    const actor = await requirePermission("ASSIGN_REVIEWER");
    const { opportunityId, reviewerId } = assignReviewerSchema.parse(input);

    const detail = await prisma.$transaction(async (tx) => {
      const current = await findOpportunityForWrite(tx, opportunityId);
      assertNotArchived(current);

      const previous = current.assignedReviewer;
      if (reviewerId === null && previous === null) throw new ActionFailure(ERRORS.NO_REVIEWER_ASSIGNED);
      if (reviewerId !== null && previous?.id === reviewerId) throw new ActionFailure(ERRORS.ALREADY_ASSIGNED);

      // The role is read from the database, never taken from the client.
      const next =
        reviewerId === null
          ? null
          : await tx.user.findFirst({
              where: { id: reviewerId, role: "REVIEWER" },
              select: { id: true, name: true },
            });
      if (reviewerId !== null && next === null) throw new ActionFailure(ERRORS.INVALID_REVIEWER);

      assertUpdated(
        await tx.opportunity.updateMany({
          where: { id: opportunityId, isArchived: false, assignedReviewerId: previous?.id ?? null },
          data: { assignedReviewerId: next?.id ?? null },
        }),
      );
      await writeActivity(tx, {
        opportunityId,
        actorId: actor.id,
        type: "REVIEWER_ASSIGNMENT",
        metadata: {
          previousReviewer: previous?.id ?? null,
          newReviewer: next?.id ?? null,
          previousReviewerName: previous?.name ?? null,
          newReviewerName: next?.name ?? null,
        },
      });
      return requireDetail(tx, opportunityId);
    });
    return ok(detail);
  });
}

export async function changeStage(input: unknown): Result {
  return runAction(async () => {
    const actor = await requirePermission("CHANGE_STAGE");
    const { opportunityId, targetStage } = changeStageSchema.parse(input);

    const detail = await prisma.$transaction(async (tx) => {
      const current = await findOpportunityForWrite(tx, opportunityId);
      assertNotArchived(current);

      const transition = assertTransition(current.stage, targetStage);
      if (!transition.success) throw new ActionFailure(transition.error);

      // Conditional on the stage we validated, so of two concurrent requests only one can win.
      assertUpdated(
        await tx.opportunity.updateMany({
          where: { id: opportunityId, stage: current.stage, isArchived: false },
          data: { stage: targetStage },
        }),
      );
      await writeActivity(tx, {
        opportunityId,
        actorId: actor.id,
        type: "STAGE_CHANGE",
        metadata: { previousStage: current.stage, newStage: targetStage },
      });
      return requireDetail(tx, opportunityId);
    });
    return ok(detail);
  });
}

export async function archiveOpportunity(input: unknown): Result {
  return runAction(async () => {
    const actor = await requirePermission("ARCHIVE");
    const { opportunityId } = archiveOpportunitySchema.parse(input);

    const detail = await prisma.$transaction(async (tx) => {
      const current = await findOpportunityForWrite(tx, opportunityId);
      if (current.isArchived) throw new ActionFailure(ERRORS.ALREADY_ARCHIVED);

      assertUpdated(
        await tx.opportunity.updateMany({
          where: { id: opportunityId, isArchived: false },
          data: { isArchived: true },
        }),
      );
      await writeActivity(tx, { opportunityId, actorId: actor.id, type: "ARCHIVED", metadata: {} });
      return requireDetail(tx, opportunityId);
    });
    return ok(detail);
  });
}

export async function restoreOpportunity(input: unknown): Result {
  return runAction(async () => {
    const actor = await requirePermission("RESTORE");
    const { opportunityId } = restoreOpportunitySchema.parse(input);

    const detail = await prisma.$transaction(async (tx) => {
      const current = await findOpportunityForWrite(tx, opportunityId);
      if (!current.isArchived) throw new ActionFailure(ERRORS.NOT_ARCHIVED);

      assertUpdated(
        await tx.opportunity.updateMany({
          where: { id: opportunityId, isArchived: true },
          data: { isArchived: false },
        }),
      );
      await writeActivity(tx, { opportunityId, actorId: actor.id, type: "RESTORED", metadata: {} });
      return requireDetail(tx, opportunityId);
    });
    return ok(detail);
  });
}
