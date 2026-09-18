import "server-only";
import type { Prisma } from "@prisma/client";

const userRef = { select: { id: true, name: true } } as const;

export const opportunitySummarySelect = {
  id: true,
  companyName: true,
  requestedAmount: true,
  currency: true,
  stage: true,
  submissionDate: true,
  isArchived: true,
  assignedReviewer: userRef,
} satisfies Prisma.OpportunitySelect;

export const opportunityDetailSelect = {
  ...opportunitySummarySelect,
  description: true,
  createdAt: true,
  updatedAt: true,
  createdBy: userRef,
  comments: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, content: true, createdAt: true, author: userRef },
  },
  activities: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, metadata: true, createdAt: true, actor: userRef },
  },
} satisfies Prisma.OpportunitySelect;

/** Prisma's `contains` passes LIKE wildcards through, so a search for "%" would match everything. */
export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, "\\$&");
