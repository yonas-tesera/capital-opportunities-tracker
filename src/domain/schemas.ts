import { z } from "zod";
import { CURRENCIES, STAGES } from "./enums";

// None of these schemas accept a user id or role: identity always comes from the server session.

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 10_000;

const idSchema = z
  .string({ error: "Id is required." })
  .trim()
  .min(1, "Id is required.")
  .max(64, "Id is invalid.");

const companyNameSchema = z
  .string({ error: "Company name is required." })
  .trim()
  .min(1, "Company name is required.")
  .max(200, "Company name must be at most 200 characters.");

// Kept as a decimal string (never a float) so it maps losslessly onto Decimal(18,2).
const requestedAmountSchema = z
  .union([z.string(), z.number()], { error: "Requested amount is required." })
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,16}(\.\d{1,2})?$/,
        "Requested amount must be a positive number with at most 2 decimal places.",
      )
      .refine((value) => /[1-9]/.test(value), "Requested amount must be greater than zero."),
  );

const currencySchema = z.enum(CURRENCIES, { error: "Currency must be one of USD, EUR or GBP." });

const submissionDateSchema = z
  .union([z.date(), z.string().trim().min(1)], { error: "Submission date is required." })
  .pipe(z.coerce.date({ error: "Submission date must be a valid date." }));

const descriptionSchema = z
  .string({ error: "Description must be text." })
  .trim()
  .max(500, "Description must be at most 500 characters.");

const opportunityFields = {
  companyName: companyNameSchema,
  requestedAmount: requestedAmountSchema,
  currency: currencySchema,
  submissionDate: submissionDateSchema,
  description: descriptionSchema,
};

export const createOpportunitySchema = z.object(opportunityFields);
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const updateOpportunitySchema = z.object({ id: idSchema, ...opportunityFields });
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

export const assignReviewerSchema = z.object({
  opportunityId: idSchema,
  reviewerId: idSchema.nullable(),
});
export type AssignReviewerInput = z.infer<typeof assignReviewerSchema>;

export const changeStageSchema = z.object({
  opportunityId: idSchema,
  targetStage: z.enum(STAGES, { error: "Target stage must be a valid stage." }),
});
export type ChangeStageInput = z.infer<typeof changeStageSchema>;

export const addCommentSchema = z.object({
  opportunityId: idSchema,
  content: z
    .string({ error: "Comment is required." })
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(1000, "Comment must be at most 1000 characters."),
});
export type AddCommentInput = z.infer<typeof addCommentSchema>;

export const archiveOpportunitySchema = z.object({ opportunityId: idSchema });
export type ArchiveOpportunityInput = z.infer<typeof archiveOpportunitySchema>;

export const restoreOpportunitySchema = z.object({ opportunityId: idSchema });
export type RestoreOpportunityInput = z.infer<typeof restoreOpportunitySchema>;

// Every field falls back to its default on invalid input so a hand-edited URL never crashes a page.
export const listOpportunitiesQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .transform((value) => (value === "" ? undefined : value))
    .optional()
    .catch(undefined),
  stage: z.enum(STAGES).optional().catch(undefined),
  archived: z
    .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
    .catch(false),
  sortBy: z.enum(["submissionDate", "requestedAmount"]).catch("submissionDate"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
});
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuerySchema>;

type SearchParamsRecord = Record<string, string | string[] | undefined>;

const LIST_QUERY_KEYS = Object.keys(listOpportunitiesQuerySchema.shape);

export function parseListOpportunitiesQuery(
  params: URLSearchParams | SearchParamsRecord,
): ListOpportunitiesQuery {
  const raw: Record<string, string | undefined> = {};
  for (const key of LIST_QUERY_KEYS) {
    if (params instanceof URLSearchParams) {
      raw[key] = params.get(key) ?? undefined;
    } else {
      const value = params[key];
      raw[key] = Array.isArray(value) ? value[0] : value;
    }
  }
  return listOpportunitiesQuerySchema.parse(raw);
}
