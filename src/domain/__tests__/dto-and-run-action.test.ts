import { describe, expect, it, vi } from "vitest";
import { serializeActivity, serializeOpportunitySummary } from "../dto";
import { addCommentSchema } from "../schemas";
import { ERRORS, fail, isError, ok } from "../result";
import { ActionFailure, runAction } from "../run-action";

const alice = { id: "u1", name: "Alice" };

describe("serializers", () => {
  it("converts Decimal-like and Date values to strings", () => {
    const dto = serializeOpportunitySummary({
      id: "o1",
      companyName: "Acme",
      requestedAmount: { toFixed: (dp) => (4500000).toFixed(dp) },
      currency: "USD",
      stage: "DRAFT",
      submissionDate: new Date("2026-09-01T10:00:00.000Z"),
      isArchived: false,
      assignedReviewer: null,
    });
    expect(dto.requestedAmount).toBe("4500000.00");
    expect(dto.submissionDate).toBe("2026-09-01T10:00:00.000Z");
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it("resolves reviewer ids in assignment metadata", () => {
    const item = serializeActivity(
      {
        id: "a1",
        type: "REVIEWER_ASSIGNMENT",
        metadata: { previousReviewer: null, newReviewer: "u1" },
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        actor: alice,
      },
      new Map([["u1", alice]]),
    );
    expect(item.type).toBe("REVIEWER_ASSIGNMENT");
    if (item.type === "REVIEWER_ASSIGNMENT") {
      expect(item.metadata).toEqual({ previousReviewer: null, newReviewer: alice });
    }
  });

  it("rejects malformed metadata", () => {
    expect(() =>
      serializeActivity(
        { id: "a1", type: "STAGE_CHANGE", metadata: { previousStage: "X" }, createdAt: new Date(), actor: alice },
        new Map(),
      ),
    ).toThrow("Malformed STAGE_CHANGE metadata");
  });
});

describe("runAction", () => {
  it("passes results through", async () => {
    expect(await runAction(async () => ok(1))).toEqual({ success: true, data: 1 });
    expect(await runAction(async () => fail("nope"))).toEqual({ success: false, error: "nope" });
  });

  it("converts ZodError into a validation failure", async () => {
    const result = await runAction(async () => ok(addCommentSchema.parse({ opportunityId: "o1", content: "" })));
    expect(isError(result, "VALIDATION")).toBe(true);
    expect(result.error).toContain("content: Comment cannot be empty.");
  });

  it("turns an ActionFailure into its message", async () => {
    const result = await runAction(async () => {
      throw new ActionFailure(ERRORS.NOT_FOUND);
    });
    expect(result).toEqual({ success: false, error: ERRORS.NOT_FOUND });
  });

  it("hides unexpected error details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await runAction(async () => {
      throw new Error("connection string postgres://secret");
    });
    expect(result).toEqual({ success: false, error: ERRORS.INTERNAL });
    spy.mockRestore();
  });
});
