// Pure mirrors of the Prisma enums, so the domain layer never imports the Prisma client.
// Prisma's generated enum types are structurally identical string unions and stay assignable.

export const ROLES = ["ADMIN", "REVIEWER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const STAGES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
export type Stage = (typeof STAGES)[number];

export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ACTIVITY_TYPES = [
  "CREATION",
  "STAGE_CHANGE",
  "REVIEWER_ASSIGNMENT",
  "COMMENT_ADDED",
  "ARCHIVED",
  "RESTORED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
