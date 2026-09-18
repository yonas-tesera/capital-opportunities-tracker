"use server";

import { serializeComment, type CommentDTO } from "@/domain/dto";
import { ERRORS, ok, type ActionResult } from "@/domain/result";
import { ActionFailure, runAction } from "@/domain/run-action";
import { addCommentSchema } from "@/domain/schemas";
import { requirePermission } from "@/lib/action-guard";
import { writeActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";

/** Assumption: commenting stays allowed on archived opportunities (archiving only freezes edits and stage changes). */
export async function addComment(input: unknown): Promise<ActionResult<CommentDTO>> {
  return runAction(async () => {
    const author = await requirePermission("ADD_COMMENT");
    const { opportunityId, content } = addCommentSchema.parse(input);

    const comment = await prisma.$transaction(async (tx) => {
      const exists = await tx.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true } });
      if (!exists) throw new ActionFailure(ERRORS.NOT_FOUND);

      const createdAt = new Date();
      const created = await tx.comment.create({
        data: { opportunityId, authorId: author.id, content, createdAt },
        select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true } } },
      });
      await writeActivity(
        tx,
        { opportunityId, actorId: author.id, type: "COMMENT_ADDED", metadata: { commentId: created.id } },
        createdAt,
      );
      return created;
    });
    return ok(serializeComment(comment));
  });
}
