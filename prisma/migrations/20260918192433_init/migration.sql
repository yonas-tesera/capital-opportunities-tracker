-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'REVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATION', 'STAGE_CHANGE', 'REVIEWER_ASSIGNMENT', 'COMMENT_ADDED', 'ARCHIVED', 'RESTORED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "stage" "Stage" NOT NULL DEFAULT 'DRAFT',
    "submissionDate" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "assignedReviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Opportunity_isArchived_stage_submissionDate_idx" ON "Opportunity"("isArchived", "stage", "submissionDate" DESC);

-- CreateIndex
CREATE INDEX "Opportunity_isArchived_requestedAmount_idx" ON "Opportunity"("isArchived", "requestedAmount");

-- CreateIndex
CREATE INDEX "Opportunity_submissionDate_idx" ON "Opportunity"("submissionDate" DESC);

-- CreateIndex
CREATE INDEX "Opportunity_assignedReviewerId_isArchived_stage_idx" ON "Opportunity"("assignedReviewerId", "isArchived", "stage");

-- CreateIndex
CREATE INDEX "Opportunity_createdById_idx" ON "Opportunity"("createdById");

-- CreateIndex
CREATE INDEX "Comment_opportunityId_createdAt_idx" ON "Comment"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "ActivityLog_opportunityId_createdAt_idx" ON "ActivityLog"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma cannot model (see header of schema.prisma)
ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_requestedAmount_positive" CHECK ("requestedAmount" > 0),
  ADD CONSTRAINT "Opportunity_description_max_length" CHECK (char_length("description") <= 500);

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_content_length" CHECK (char_length("content") BETWEEN 1 AND 1000);

-- ActivityLog is append-only: reject UPDATE and DELETE
CREATE FUNCTION "activity_log_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActivityLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActivityLog_append_only"
  BEFORE UPDATE OR DELETE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION "activity_log_append_only"();

CREATE TRIGGER "ActivityLog_no_truncate"
  BEFORE TRUNCATE ON "ActivityLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "activity_log_append_only"();
