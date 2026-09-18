"use server";

import { serializeOpportunitySummary, type DashboardStatsDTO } from "@/domain/dto";
import type { Currency, Stage } from "@/domain/enums";
import { ok, type ActionResult } from "@/domain/result";
import { runAction } from "@/domain/run-action";
import { requirePermission } from "@/lib/action-guard";
import { prisma } from "@/lib/db";
import { opportunitySummarySelect } from "@/lib/opportunity-queries";

const RECENT_LIMIT = 5;

export async function getDashboardStats(): Promise<ActionResult<DashboardStatsDTO>> {
  return runAction(async () => {
    await requirePermission("VIEW");

    const active = { isArchived: false };
    const [stageGroups, currencyGroups, totalArchived, recent, reviewers] = await Promise.all([
      prisma.opportunity.groupBy({ by: ["stage"], where: active, _count: { _all: true } }),
      prisma.opportunity.groupBy({ by: ["currency"], where: active, _sum: { requestedAmount: true } }),
      prisma.opportunity.count({ where: { isArchived: true } }),
      prisma.opportunity.findMany({
        where: active,
        orderBy: [{ submissionDate: "desc" }, { id: "asc" }],
        take: RECENT_LIMIT,
        select: opportunitySummarySelect,
      }),
      prisma.user.findMany({
        where: { role: "REVIEWER" },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          _count: { select: { assignedOpportunities: { where: active } } },
        },
      }),
    ]);

    const byStage: Record<Stage, number> = { DRAFT: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
    for (const group of stageGroups) byStage[group.stage] = group._count._all;

    const requestedAmountByCurrency: Record<Currency, string> = { USD: "0.00", EUR: "0.00", GBP: "0.00" };
    for (const group of currencyGroups) {
      if (group._sum.requestedAmount) {
        requestedAmountByCurrency[group.currency] = group._sum.requestedAmount.toFixed(2);
      }
    }

    return ok({
      totalActive: Object.values(byStage).reduce((sum, count) => sum + count, 0),
      totalArchived,
      byStage,
      requestedAmountByCurrency,
      reviewerWorkload: reviewers.map((reviewer) => ({
        reviewer: { id: reviewer.id, name: reviewer.name },
        openCount: reviewer._count.assignedOpportunities,
      })),
      recent: recent.map(serializeOpportunitySummary),
    });
  });
}
