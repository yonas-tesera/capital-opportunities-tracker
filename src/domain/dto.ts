import { z } from "zod";
import { STAGES, type ActivityType, type Currency, type Stage } from "./enums";

// ---------------------------------------------------------------------------
// DTOs: only strings, numbers, booleans and plain objects cross the server/client boundary.
// ---------------------------------------------------------------------------

export interface UserRefDTO {
  id: string;
  name: string;
}

export interface OpportunitySummaryDTO {
  id: string;
  companyName: string;
  requestedAmount: string;
  currency: Currency;
  stage: Stage;
  submissionDate: string;
  isArchived: boolean;
  assignedReviewer: UserRefDTO | null;
}

export interface OpportunityDetailDTO extends OpportunitySummaryDTO {
  description: string;
  createdBy: UserRefDTO;
  createdAt: string;
  updatedAt: string;
  comments: CommentDTO[];
  /** Chronological, oldest first. */
  timeline: ActivityTimelineItemDTO[];
}

export interface CommentDTO {
  id: string;
  content: string;
  createdAt: string;
  author: UserRefDTO;
}

interface TimelineItemBase {
  id: string;
  createdAt: string;
  actor: UserRefDTO;
}

export type ActivityTimelineItemDTO =
  | (TimelineItemBase & { type: "CREATION"; metadata: { stage: Stage } })
  | (TimelineItemBase & { type: "STAGE_CHANGE"; metadata: { previousStage: Stage; newStage: Stage } })
  | (TimelineItemBase & {
      type: "REVIEWER_ASSIGNMENT";
      metadata: { previousReviewer: UserRefDTO | null; newReviewer: UserRefDTO | null };
    })
  | (TimelineItemBase & { type: "COMMENT_ADDED"; metadata: { commentId: string } })
  | (TimelineItemBase & { type: "ARCHIVED"; metadata: Record<string, never> })
  | (TimelineItemBase & { type: "RESTORED"; metadata: Record<string, never> });

export interface ReviewerWorkloadDTO {
  reviewer: UserRefDTO;
  openCount: number;
}

export interface DashboardStatsDTO {
  totalActive: number;
  totalArchived: number;
  byStage: Record<Stage, number>;
  /** Decimal strings per currency; amounts in different currencies are never summed together. */
  requestedAmountByCurrency: Record<Currency, string>;
  reviewerWorkload: ReviewerWorkloadDTO[];
  recent: OpportunitySummaryDTO[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---------------------------------------------------------------------------
// Serializers: structural row types, so Prisma results are assignable without importing Prisma.
// ---------------------------------------------------------------------------

/** Prisma.Decimal satisfies this. */
export interface DecimalLike {
  toFixed(decimalPlaces: number): string;
}

export interface OpportunitySummaryRow {
  id: string;
  companyName: string;
  requestedAmount: DecimalLike;
  currency: Currency;
  stage: Stage;
  submissionDate: Date;
  isArchived: boolean;
  assignedReviewer: UserRefDTO | null;
}

export interface OpportunityDetailRow extends OpportunitySummaryRow {
  description: string;
  createdBy: UserRefDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentRow {
  id: string;
  content: string;
  createdAt: Date;
  author: UserRefDTO;
}

export interface ActivityRow {
  id: string;
  type: ActivityType;
  metadata: unknown;
  createdAt: Date;
  actor: UserRefDTO;
}

export const formatAmount = (amount: DecimalLike): string => amount.toFixed(2);

export function serializeOpportunitySummary(row: OpportunitySummaryRow): OpportunitySummaryDTO {
  return {
    id: row.id,
    companyName: row.companyName,
    requestedAmount: formatAmount(row.requestedAmount),
    currency: row.currency,
    stage: row.stage,
    submissionDate: row.submissionDate.toISOString(),
    isArchived: row.isArchived,
    assignedReviewer: row.assignedReviewer,
  };
}

export function serializeOpportunityDetail(
  row: OpportunityDetailRow,
  comments: CommentDTO[],
  timeline: ActivityTimelineItemDTO[],
): OpportunityDetailDTO {
  return {
    ...serializeOpportunitySummary(row),
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    comments,
    timeline,
  };
}

export function serializeComment(row: CommentRow): CommentDTO {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    author: row.author,
  };
}

// ActivityLog.metadata is untyped JSON in the DB, so each shape is validated on read.
const stageSchema = z.enum(STAGES);
const metadataSchemas = {
  CREATION: z.object({ stage: stageSchema }),
  STAGE_CHANGE: z.object({ previousStage: stageSchema, newStage: stageSchema }),
  REVIEWER_ASSIGNMENT: z.object({
    previousReviewer: z.string().nullable(),
    newReviewer: z.string().nullable(),
    // Snapshot of the names at assignment time; absent on older entries.
    previousReviewerName: z.string().nullable().optional(),
    newReviewerName: z.string().nullable().optional(),
  }),
  COMMENT_ADDED: z.object({ commentId: z.string() }),
  ARCHIVED: z.object({}),
  RESTORED: z.object({}),
} as const;

/** Reviewer ids referenced by assignment entries, so callers can load their names. */
export function collectReviewerIds(rows: readonly ActivityRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.type !== "REVIEWER_ASSIGNMENT") continue;
    const parsed = metadataSchemas.REVIEWER_ASSIGNMENT.safeParse(row.metadata);
    if (!parsed.success) continue;
    for (const id of [parsed.data.previousReviewer, parsed.data.newReviewer]) {
      if (id !== null) ids.add(id);
    }
  }
  return [...ids];
}

// A plain Error (not ZodError): bad stored metadata is a server fault, not a client validation problem.
function parseMetadata<S extends z.ZodType>(schema: S, row: ActivityRow): z.output<S> {
  const parsed = schema.safeParse(row.metadata);
  if (!parsed.success) throw new Error(`Malformed ${row.type} metadata on activity ${row.id}`);
  return parsed.data;
}

const UNKNOWN_USER = "Unknown user";

/** `users` resolves reviewer ids stored in metadata to display names. */
export function serializeActivity(
  row: ActivityRow,
  users: ReadonlyMap<string, UserRefDTO>,
): ActivityTimelineItemDTO {
  const base = { id: row.id, createdAt: row.createdAt.toISOString(), actor: row.actor };
  const resolve = (id: string | null, storedName?: string | null): UserRefDTO | null =>
    id === null ? null : (users.get(id) ?? { id, name: storedName ?? UNKNOWN_USER });

  switch (row.type) {
    case "CREATION":
      return { ...base, type: row.type, metadata: parseMetadata(metadataSchemas.CREATION, row) };
    case "STAGE_CHANGE":
      return { ...base, type: row.type, metadata: parseMetadata(metadataSchemas.STAGE_CHANGE, row) };
    case "REVIEWER_ASSIGNMENT": {
      const meta = parseMetadata(metadataSchemas.REVIEWER_ASSIGNMENT, row);
      return {
        ...base,
        type: row.type,
        metadata: {
          previousReviewer: resolve(meta.previousReviewer, meta.previousReviewerName),
          newReviewer: resolve(meta.newReviewer, meta.newReviewerName),
        },
      };
    }
    case "COMMENT_ADDED":
      return { ...base, type: row.type, metadata: parseMetadata(metadataSchemas.COMMENT_ADDED, row) };
    case "ARCHIVED":
    case "RESTORED":
      parseMetadata(metadataSchemas[row.type], row);
      return { ...base, type: row.type, metadata: {} };
  }
}
