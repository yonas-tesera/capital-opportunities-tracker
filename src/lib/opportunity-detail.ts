import "server-only";
import type { Prisma } from "@prisma/client";
import {
  collectReviewerIds,
  serializeActivity,
  serializeComment,
  serializeOpportunityDetail,
  type OpportunityDetailDTO,
} from "@/domain/dto";
import { opportunityDetailSelect } from "@/lib/opportunity-queries";

/** Works with the shared client or a transaction client, so mutations can return the state they just wrote. */
export async function loadOpportunityDetail(
  client: Prisma.TransactionClient,
  id: string,
): Promise<OpportunityDetailDTO | null> {
  const row = await client.opportunity.findUnique({ where: { id }, select: opportunityDetailSelect });
  if (!row) return null;

  const reviewerIds = collectReviewerIds(row.activities);
  const reviewers =
    reviewerIds.length > 0
      ? await client.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
      : [];
  const usersById = new Map(reviewers.map((user) => [user.id, user]));

  return serializeOpportunityDetail(
    row,
    row.comments.map(serializeComment),
    row.activities.map((activity) => serializeActivity(activity, usersById)),
  );
}
