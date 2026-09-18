import { describe, expect, it } from "vitest";
import {
  addCommentSchema,
  assignReviewerSchema,
  changeStageSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
} from "../schemas";

const valid = {
  companyName: "  Acme Capital  ",
  requestedAmount: "1500000.5",
  currency: "EUR",
  submissionDate: "2026-09-01",
  description: "A description",
};

describe("opportunity schemas", () => {
  it("trims and normalises valid input", () => {
    const parsed = createOpportunitySchema.parse(valid);
    expect(parsed.companyName).toBe("Acme Capital");
    expect(parsed.requestedAmount).toBe("1500000.5");
    expect(parsed.submissionDate).toBeInstanceOf(Date);
  });

  it("accepts numeric amounts", () => {
    expect(createOpportunitySchema.parse({ ...valid, requestedAmount: 250 }).requestedAmount).toBe("250");
  });

  it.each(["0", "0.00", "-5", "1.234", "abc", "", "1e5", "12345678901234567"])("rejects amount %j", (amount) => {
    expect(createOpportunitySchema.safeParse({ ...valid, requestedAmount: amount }).success).toBe(false);
  });

  it.each([
    { companyName: "   " },
    { companyName: "x".repeat(201) },
    { currency: "JPY" },
    { submissionDate: "not a date" },
    { submissionDate: "" },
    { description: "x".repeat(501) },
  ])("rejects %j", (override) => {
    expect(createOpportunitySchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("requires an id on update", () => {
    expect(updateOpportunitySchema.safeParse(valid).success).toBe(false);
    expect(updateOpportunitySchema.safeParse({ ...valid, id: "abc" }).success).toBe(true);
  });

  it("strips client-supplied identity fields", () => {
    const parsed = createOpportunitySchema.parse({ ...valid, createdById: "x", role: "ADMIN", userId: "y" });
    expect(parsed).not.toHaveProperty("createdById");
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("userId");
  });
});

describe("other schemas", () => {
  it("allows a null reviewer to unassign", () => {
    expect(assignReviewerSchema.parse({ opportunityId: "o1", reviewerId: null }).reviewerId).toBeNull();
    expect(assignReviewerSchema.safeParse({ opportunityId: "o1" }).success).toBe(false);
  });

  it("validates target stage", () => {
    expect(changeStageSchema.safeParse({ opportunityId: "o1", targetStage: "APPROVED" }).success).toBe(true);
    expect(changeStageSchema.safeParse({ opportunityId: "o1", targetStage: "DONE" }).success).toBe(false);
  });

  it("validates comment length after trimming", () => {
    expect(addCommentSchema.safeParse({ opportunityId: "o1", content: "   " }).success).toBe(false);
    expect(addCommentSchema.safeParse({ opportunityId: "o1", content: "x".repeat(1000) }).success).toBe(true);
    expect(addCommentSchema.safeParse({ opportunityId: "o1", content: "x".repeat(1001) }).success).toBe(false);
  });
});
