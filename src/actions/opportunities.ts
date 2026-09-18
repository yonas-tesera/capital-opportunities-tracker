"use server";

import {
  paginate,
  serializeOpportunitySummary,
  type OpportunityDetailDTO,
  type OpportunitySummaryDTO,
  type PaginatedResult,
} from "@/domain/dto";
import { ERRORS, fail, ok, type ActionResult } from "@/domain/result";
import { runAction } from "@/domain/run-action";
import { listOpportunitiesQuerySchema, opportunityIdSchema } from "@/domain/schemas";
import { requirePermission } from "@/lib/action-guard";
import { prisma } from "@/lib/db";
import { loadOpportunityDetail } from "@/lib/opportunity-detail";
import { escapeLike, opportunitySummarySelect } from "@/lib/opportunity-queries";

/**
 * Archived filter: `archived: false` (default) hides archived opportunities,
 * `archived: true` shows archived opportunities only. A page past the last one is
 * clamped to the last page, and the returned `page` is the page actually served.
 */
export async function listOpportunities(
  input: unknown,
): Promise<ActionResult<PaginatedResult<OpportunitySummaryDTO>>> {
  return runAction(async () => {
    await requirePermission("VIEW");
    const query = listOpportunitiesQuerySchema.parse(input ?? {});

    const where = {
      isArchived: query.archived,
      ...(query.stage && { stage: query.stage }),
      ...(query.search && { companyName: { contains: escapeLike(query.search), mode: "insensitive" as const } }),
    };

    const total = await prisma.opportunity.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);

    const rows = await prisma.opportunity.findMany({
      where,
      orderBy: [{ [query.sortBy]: query.sortDir }, { id: "asc" }],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
      select: opportunitySummarySelect,
    });

    return ok(paginate(rows.map(serializeOpportunitySummary), total, page, query.pageSize));
  });
}

export async function getOpportunity(id: unknown): Promise<ActionResult<OpportunityDetailDTO>> {
  return runAction(async () => {
    await requirePermission("VIEW");
    const opportunityId = opportunityIdSchema.parse(id);

    const detail = await loadOpportunityDetail(prisma, opportunityId);
    return detail ? ok(detail) : fail(ERRORS.NOT_FOUND);
  });
}
