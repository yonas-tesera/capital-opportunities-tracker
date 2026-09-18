import "server-only";
import type { Prisma } from "@prisma/client";
import type { Stage } from "@/domain/enums";

type ActivityEntry = { opportunityId: string; actorId: string } & (
  | { type: "CREATION"; metadata: { stage: Stage } }
  | { type: "STAGE_CHANGE"; metadata: { previousStage: Stage; newStage: Stage } }
  | {
      type: "REVIEWER_ASSIGNMENT";
      metadata: {
        previousReviewer: string | null;
        newReviewer: string | null;
        previousReviewerName: string | null;
        newReviewerName: string | null;
      };
    }
  | { type: "COMMENT_ADDED"; metadata: { commentId: string } }
  | { type: "ARCHIVED" | "RESTORED"; metadata: Record<string, never> }
);

/** The only writer of ActivityLog rows; always called with the transaction client of the change it records. */
export async function writeActivity(
  tx: Prisma.TransactionClient,
  entry: ActivityEntry,
  createdAt: Date = new Date(),
): Promise<void> {
  await tx.activityLog.create({ data: { ...entry, createdAt } });
}
