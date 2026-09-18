import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addComment } from "@/actions/comments";
import {
  archiveOpportunity,
  assignReviewer,
  changeStage,
  createOpportunity,
  restoreOpportunity,
  updateOpportunity,
} from "@/actions/opportunity-mutations";
import { getOpportunity } from "@/actions/opportunities";
import { ROLES, STAGES, type Role, type Stage } from "@/domain/enums";
import { can, type Permission } from "@/domain/rbac";
import { ERRORS, isError, type ActionResult } from "@/domain/result";
import { canTransition } from "@/domain/state-machine";
import {
  activityFor,
  db,
  failActivityInserts,
  makeOpportunity,
  resetDatabase,
  signInAs,
  USERS,
  type UserKey,
} from "../../../test/helpers";

const ROLE_USER: Record<Role, UserKey> = { ADMIN: "admin", REVIEWER: "reviewer1", VIEWER: "viewer" };

const validFields = {
  companyName: "  New Co  ",
  requestedAmount: "2500.50",
  currency: "GBP",
  submissionDate: "2026-09-10",
  description: "Some description",
};

beforeEach(async () => {
  await resetDatabase();
  signInAs("admin");
  // Failed actions log the underlying error on the server; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterAll(() => db.$disconnect());

describe("authentication", () => {
  it("rejects calls without a session", async () => {
    signInAs(null);
    const id = await makeOpportunity();
    for (const result of [
      await createOpportunity(validFields),
      await changeStage({ opportunityId: id, targetStage: "UNDER_REVIEW" }),
      await addComment({ opportunityId: id, content: "hi" }),
      await getOpportunity(id),
    ]) {
      expect(isError(result, "UNAUTHENTICATED")).toBe(true);
    }
    expect(await activityFor(id)).toHaveLength(0);
  });

  it("rejects a session whose user no longer exists", async () => {
    signInAs({ id: "ghost" });
    expect(isError(await createOpportunity(validFields), "UNAUTHENTICATED")).toBe(true);
  });
});

describe("RBAC matrix", () => {
  // Each action is attempted by every role on a fresh DRAFT opportunity.
  const actions: Array<{
    permission: Permission;
    /** ActivityLog rows a successful call writes (editing is not logged). */
    logs: number;
    run: (id: string, role: Role) => Promise<ActionResult<unknown>>;
  }> = [
    { permission: "CREATE", logs: 1, run: () => createOpportunity(validFields) },
    { permission: "EDIT", logs: 0, run: (id) => updateOpportunity({ id, ...validFields }) },
    {
      permission: "ASSIGN_REVIEWER",
      logs: 1,
      run: (id) => assignReviewer({ opportunityId: id, reviewerId: USERS.reviewer2.id }),
    },
    { permission: "CHANGE_STAGE", logs: 1, run: (id) => changeStage({ opportunityId: id, targetStage: "UNDER_REVIEW" }) },
    { permission: "ADD_COMMENT", logs: 1, run: (id) => addComment({ opportunityId: id, content: "A comment" }) },
    { permission: "ARCHIVE", logs: 1, run: (id) => archiveOpportunity({ opportunityId: id }) },
  ];

  for (const { permission, logs, run } of actions) {
    for (const role of ROLES) {
      const allowed = can(role, permission);
      it(`${permission} as ${role} is ${allowed ? "allowed" : "forbidden"}`, async () => {
        const id = await makeOpportunity();
        signInAs(ROLE_USER[role]);
        const before = await db.activityLog.count();

        const result = await run(id, role);

        if (allowed) {
          expect(result.success).toBe(true);
          expect(await db.activityLog.count()).toBe(before + logs);
        } else {
          expect(isError(result, "FORBIDDEN")).toBe(true);
          expect(await db.activityLog.count()).toBe(before);
        }
      });
    }
  }

  for (const role of ROLES) {
    it(`RESTORE as ${role} is ${can(role, "RESTORE") ? "allowed" : "forbidden"}`, async () => {
      const id = await makeOpportunity({ isArchived: true });
      signInAs(ROLE_USER[role]);
      const result = await restoreOpportunity({ opportunityId: id });
      expect(result.success).toBe(can(role, "RESTORE"));
      if (!can(role, "RESTORE")) expect(isError(result, "FORBIDDEN")).toBe(true);
    });
  }
});

describe("createOpportunity", () => {
  it("creates a DRAFT owned by the session user with a CREATION entry, ignoring client identity fields", async () => {
    const result = await createOpportunity({ ...validFields, createdById: "u_viewer", stage: "APPROVED", role: "VIEWER" });

    expect(result.success).toBe(true);
    const created = result.data;
    expect(created?.stage).toBe("DRAFT");
    expect(created?.createdBy.id).toBe(USERS.admin.id);
    expect(created?.companyName).toBe("New Co");
    expect(created?.requestedAmount).toBe("2500.50");
    const log = await activityFor(created?.id ?? "");
    expect(log.map((entry) => [entry.type, entry.actorId, entry.metadata])).toEqual([
      ["CREATION", USERS.admin.id, { stage: "DRAFT" }],
    ]);
  });

  it("validates before touching the database", async () => {
    const result = await createOpportunity({ ...validFields, description: "x".repeat(501) });
    expect(isError(result, "VALIDATION")).toBe(true);
    expect(await db.opportunity.count()).toBe(0);
  });
});

describe("updateOpportunity", () => {
  it("updates fields without writing an activity entry", async () => {
    const id = await makeOpportunity();
    const before = await db.opportunity.findUniqueOrThrow({ where: { id } });

    const result = await updateOpportunity({ id, ...validFields });

    expect(result.success).toBe(true);
    expect(result.data?.companyName).toBe("New Co");
    expect(result.data?.currency).toBe("GBP");
    const after = await db.opportunity.findUniqueOrThrow({ where: { id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(await activityFor(id)).toHaveLength(0);
  });

  it("is NOT_FOUND for a missing id", async () => {
    expect(isError(await updateOpportunity({ id: "missing", ...validFields }), "NOT_FOUND")).toBe(true);
  });

  it("is blocked when archived", async () => {
    const id = await makeOpportunity({ isArchived: true });
    const result = await updateOpportunity({ id, ...validFields });
    expect(result.error).toBe(ERRORS.ARCHIVED);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id } })).companyName).not.toBe("New Co");
  });
});

describe("changeStage state machine", () => {
  const pairs = STAGES.flatMap((from) => STAGES.map((to) => [from, to] as const));

  it.each(pairs)("%s -> %s", async (from: Stage, to: Stage) => {
    const id = await makeOpportunity({ stage: from });
    const result = await changeStage({ opportunityId: id, targetStage: to });
    const stored = await db.opportunity.findUniqueOrThrow({ where: { id } });
    const log = await activityFor(id);

    if (canTransition(from, to)) {
      expect(result.success).toBe(true);
      expect(result.data?.stage).toBe(to);
      expect(stored.stage).toBe(to);
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        type: "STAGE_CHANGE",
        actorId: USERS.admin.id,
        metadata: { previousStage: from, newStage: to },
      });
    } else {
      expect(isError(result, "INVALID_TRANSITION")).toBe(true);
      expect(result.error).toContain(`Cannot move from ${from} to ${to}.`);
      expect(stored.stage).toBe(from);
      expect(log).toHaveLength(0);
    }
  });

  it("is blocked when archived, and reports ARCHIVED before any transition error", async () => {
    const id = await makeOpportunity({ stage: "DRAFT", isArchived: true });
    expect((await changeStage({ opportunityId: id, targetStage: "UNDER_REVIEW" })).error).toBe(ERRORS.ARCHIVED);
    expect((await changeStage({ opportunityId: id, targetStage: "APPROVED" })).error).toBe(ERRORS.ARCHIVED);
    expect(await activityFor(id)).toHaveLength(0);
  });

  it("lets a reviewer who is not assigned change the stage (no assignment restriction)", async () => {
    const id = await makeOpportunity({ stage: "UNDER_REVIEW", assignedReviewerId: USERS.reviewer2.id });
    signInAs("reviewer1");
    expect((await changeStage({ opportunityId: id, targetStage: "APPROVED" })).success).toBe(true);
  });

  it("lets exactly one of two concurrent conflicting transitions win", async () => {
    const id = await makeOpportunity({ stage: "UNDER_REVIEW" });

    const results = await Promise.all([
      changeStage({ opportunityId: id, targetStage: "APPROVED" }),
      changeStage({ opportunityId: id, targetStage: "REJECTED" }),
    ]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    const loser = results.find((r) => !r.success);
    expect(
      isError(loser ?? { success: true }, "CONFLICT") || isError(loser ?? { success: true }, "INVALID_TRANSITION"),
    ).toBe(true);
    expect(await activityFor(id)).toHaveLength(1);
  });
});

describe("assignReviewer", () => {
  it("assigns a reviewer, logging previous and new reviewer ids and names", async () => {
    const id = await makeOpportunity({ assignedReviewerId: USERS.reviewer1.id });
    const result = await assignReviewer({ opportunityId: id, reviewerId: USERS.reviewer2.id });

    expect(result.data?.assignedReviewer).toEqual({ id: USERS.reviewer2.id, name: USERS.reviewer2.name });
    const [entry] = await activityFor(id);
    expect(entry).toMatchObject({
      type: "REVIEWER_ASSIGNMENT",
      actorId: USERS.admin.id,
      metadata: {
        previousReviewer: USERS.reviewer1.id,
        newReviewer: USERS.reviewer2.id,
        previousReviewerName: USERS.reviewer1.name,
        newReviewerName: USERS.reviewer2.name,
      },
    });
  });

  it.each([
    ["an ADMIN", USERS.admin.id],
    ["a VIEWER", USERS.viewer.id],
    ["a user that does not exist", "nobody"],
  ])("rejects %s as a reviewer, checking the role in the DB", async (_label, reviewerId) => {
    const id = await makeOpportunity();
    const result = await assignReviewer({ opportunityId: id, reviewerId });
    expect(result.error).toBe(ERRORS.INVALID_REVIEWER);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id } })).assignedReviewerId).toBeNull();
    expect(await activityFor(id)).toHaveLength(0);
  });

  it("rejects re-assigning the same reviewer", async () => {
    const id = await makeOpportunity({ assignedReviewerId: USERS.reviewer1.id });
    const result = await assignReviewer({ opportunityId: id, reviewerId: USERS.reviewer1.id });
    expect(result.error).toBe(ERRORS.ALREADY_ASSIGNED);
    expect(await activityFor(id)).toHaveLength(0);
  });

  it("unassigns with null, and rejects unassigning when nobody is assigned", async () => {
    const id = await makeOpportunity({ assignedReviewerId: USERS.reviewer1.id });
    const unassigned = await assignReviewer({ opportunityId: id, reviewerId: null });
    expect(unassigned.data?.assignedReviewer).toBeNull();
    expect((await activityFor(id))[0]?.metadata).toMatchObject({
      previousReviewer: USERS.reviewer1.id,
      newReviewer: null,
    });

    const again = await assignReviewer({ opportunityId: id, reviewerId: null });
    expect(again.error).toBe(ERRORS.NO_REVIEWER_ASSIGNED);
  });

  it("is blocked when archived", async () => {
    const id = await makeOpportunity({ isArchived: true });
    const result = await assignReviewer({ opportunityId: id, reviewerId: USERS.reviewer1.id });
    expect(result.error).toBe(ERRORS.ARCHIVED);
  });
});

describe("addComment", () => {
  it("adds the comment and its log entry, authored by the session user", async () => {
    const id = await makeOpportunity();
    signInAs("viewer");
    const result = await addComment({ opportunityId: id, content: "  Looks good  ", authorId: "u_admin" });

    expect(result.data).toMatchObject({ content: "Looks good", author: { id: USERS.viewer.id } });
    const [entry] = await activityFor(id);
    expect(entry).toMatchObject({
      type: "COMMENT_ADDED",
      actorId: USERS.viewer.id,
      metadata: { commentId: result.data?.id },
    });
  });

  it("is allowed on archived opportunities", async () => {
    const id = await makeOpportunity({ isArchived: true });
    expect((await addComment({ opportunityId: id, content: "Still relevant" })).success).toBe(true);
  });

  it("validates content and existence", async () => {
    const id = await makeOpportunity();
    expect(isError(await addComment({ opportunityId: id, content: "   " }), "VALIDATION")).toBe(true);
    expect(isError(await addComment({ opportunityId: id, content: "x".repeat(1001) }), "VALIDATION")).toBe(true);
    expect(isError(await addComment({ opportunityId: "missing", content: "hi" }), "NOT_FOUND")).toBe(true);
    expect(await db.comment.count()).toBe(0);
  });
});

describe("archive and restore", () => {
  it("archives then restores, logging each and rejecting repeats", async () => {
    const id = await makeOpportunity();

    expect((await archiveOpportunity({ opportunityId: id })).data?.isArchived).toBe(true);
    expect((await archiveOpportunity({ opportunityId: id })).error).toBe(ERRORS.ALREADY_ARCHIVED);
    expect((await restoreOpportunity({ opportunityId: id })).data?.isArchived).toBe(false);
    expect((await restoreOpportunity({ opportunityId: id })).error).toBe(ERRORS.NOT_ARCHIVED);

    expect((await activityFor(id)).map((entry) => entry.type)).toEqual(["ARCHIVED", "RESTORED"]);
  });

  it("allows edits again after restore", async () => {
    const id = await makeOpportunity({ isArchived: true });
    await restoreOpportunity({ opportunityId: id });
    expect((await updateOpportunity({ id, ...validFields })).success).toBe(true);
  });
});

describe("transaction atomicity: a failed log write rolls the change back", () => {
  it("createOpportunity", async () => {
    const result = await failActivityInserts(() => createOpportunity(validFields));
    expect(isError(result, "INTERNAL")).toBe(true);
    expect(await db.opportunity.count()).toBe(0);
  });

  it("changeStage", async () => {
    const id = await makeOpportunity({ stage: "DRAFT" });
    const result = await failActivityInserts(() => changeStage({ opportunityId: id, targetStage: "UNDER_REVIEW" }));
    expect(result.success).toBe(false);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id } })).stage).toBe("DRAFT");
  });

  it("assignReviewer", async () => {
    const id = await makeOpportunity();
    const result = await failActivityInserts(() =>
      assignReviewer({ opportunityId: id, reviewerId: USERS.reviewer1.id }),
    );
    expect(result.success).toBe(false);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id } })).assignedReviewerId).toBeNull();
  });

  it("archiveOpportunity and restoreOpportunity", async () => {
    const active = await makeOpportunity();
    const archived = await makeOpportunity({ isArchived: true });
    await failActivityInserts(async () => {
      expect((await archiveOpportunity({ opportunityId: active })).success).toBe(false);
      expect((await restoreOpportunity({ opportunityId: archived })).success).toBe(false);
    });
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: active } })).isArchived).toBe(false);
    expect((await db.opportunity.findUniqueOrThrow({ where: { id: archived } })).isArchived).toBe(true);
  });

  it("addComment", async () => {
    const id = await makeOpportunity();
    const result = await failActivityInserts(() => addComment({ opportunityId: id, content: "hello" }));
    expect(result.success).toBe(false);
    expect(await db.comment.count()).toBe(0);
  });
});
