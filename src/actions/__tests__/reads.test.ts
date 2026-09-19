import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addComment } from "@/actions/comments";
import { getDashboardStats } from "@/actions/dashboard";
import { getOpportunity, listOpportunities } from "@/actions/opportunities";
import { changeStage, createOpportunity } from "@/actions/opportunity-mutations";
import { listReviewers } from "@/actions/reviewers";
import { isError } from "@/domain/result";
import { db, makeOpportunity, resetDatabase, signInAs, USERS, type UserKey } from "../../../test/helpers";

beforeEach(async () => {
  await resetDatabase();
  signInAs("viewer");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterAll(() => db.$disconnect());

const day = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T12:00:00Z`);

describe("every role can read", () => {
  it.each(["admin", "reviewer1", "viewer"] as UserKey[])("%s", async (user) => {
    signInAs(user);
    const id = await makeOpportunity();
    for (const result of [await getDashboardStats(), await listOpportunities({}), await getOpportunity(id), await listReviewers()]) {
      expect(result.success).toBe(true);
    }
  });
});

describe("getDashboardStats", () => {
  it("returns every key with zeros when there is no data", async () => {
    const { data } = await getDashboardStats();
    expect(data).toMatchObject({
      totalActive: 0,
      totalArchived: 0,
      byStage: { DRAFT: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 },
      requestedAmountByCurrency: { USD: "0.00", EUR: "0.00", GBP: "0.00" },
      recent: [],
    });
    expect(data?.reviewerWorkload.map((w) => [w.reviewer.id, w.openCount])).toEqual([
      [USERS.reviewer2.id, 0], // ordered by name: Ravi before Rita
      [USERS.reviewer1.id, 0],
    ]);
  });

  it("counts only active opportunities, sums per currency, and lists the 5 most recent", async () => {
    await makeOpportunity({ stage: "DRAFT", currency: "USD", requestedAmount: "100.10", assignedReviewerId: USERS.reviewer1.id });
    await makeOpportunity({ stage: "APPROVED", currency: "USD", requestedAmount: "200.20", assignedReviewerId: USERS.reviewer1.id });
    await makeOpportunity({ stage: "REJECTED", currency: "EUR", requestedAmount: "50" });
    await makeOpportunity({ stage: "DRAFT", currency: "GBP", requestedAmount: "999", isArchived: true, assignedReviewerId: USERS.reviewer2.id });
    for (let n = 1; n <= 5; n += 1) await makeOpportunity({ companyName: `Recent ${n}`, submissionDate: day(n) });

    const { data } = await getDashboardStats();
    expect(data?.totalActive).toBe(8);
    expect(data?.totalArchived).toBe(1);
    expect(data?.byStage).toEqual({ DRAFT: 6, UNDER_REVIEW: 0, APPROVED: 1, REJECTED: 1 });
    expect(data?.requestedAmountByCurrency).toEqual({ USD: "5300.30", EUR: "50.00", GBP: "0.00" });
    expect(data?.reviewerWorkload.map((w) => [w.reviewer.id, w.openCount])).toEqual([
      [USERS.reviewer2.id, 0], // its only opportunity is archived
      [USERS.reviewer1.id, 2],
    ]);
    expect(data?.recent).toHaveLength(5);
    expect(data?.recent.map((o) => o.submissionDate.slice(0, 10))).toEqual([
      "2026-09-05",
      "2026-09-04",
      "2026-09-03",
      "2026-09-02",
      "2026-09-01",
    ]);
  });
});

describe("listOpportunities", () => {
  it("hides archived by default and shows only archived when asked", async () => {
    await makeOpportunity({ companyName: "Active One" });
    await makeOpportunity({ companyName: "Archived One", isArchived: true });

    expect((await listOpportunities({})).data?.items.map((o) => o.companyName)).toEqual(["Active One"]);
    expect((await listOpportunities({ archived: true })).data?.items.map((o) => o.companyName)).toEqual(["Archived One"]);
    expect((await listOpportunities({ archived: "true" })).data?.total).toBe(1);
  });

  it("filters by stage and searches case-insensitively with literal wildcards", async () => {
    await makeOpportunity({ companyName: "Atlas Logistics", stage: "APPROVED" });
    await makeOpportunity({ companyName: "Boreal 100% Fund", stage: "DRAFT" });

    expect((await listOpportunities({ stage: "APPROVED" })).data?.items).toHaveLength(1);
    expect((await listOpportunities({ search: "aTLAS" })).data?.total).toBe(1);
    expect((await listOpportunities({ search: "100%" })).data?.total).toBe(1);
    expect((await listOpportunities({ search: "%" })).data?.total).toBe(1);
    expect((await listOpportunities({ search: "_" })).data?.total).toBe(0);
  });

  it("sorts deterministically and paginates, clamping a page past the end", async () => {
    for (const amount of ["300", "100", "200", "100"]) await makeOpportunity({ requestedAmount: amount });

    const asc = await listOpportunities({ sortBy: "requestedAmount", sortDir: "asc", pageSize: 3 });
    expect(asc.data?.items.map((o) => o.requestedAmount)).toEqual(["100.00", "100.00", "200.00"]);
    const ids = asc.data?.items.map((o) => o.id) ?? [];
    expect((await listOpportunities({ sortBy: "requestedAmount", sortDir: "asc", pageSize: 3 })).data?.items.map((o) => o.id)).toEqual(ids);

    const beyond = await listOpportunities({ sortBy: "requestedAmount", sortDir: "asc", pageSize: 3, page: 99 });
    expect(beyond.data).toMatchObject({ total: 4, page: 2, pageSize: 3, totalPages: 2 });
    expect(beyond.data?.items).toHaveLength(1);
  });

  it("falls back to defaults for invalid input instead of failing", async () => {
    await makeOpportunity();
    const result = await listOpportunities({ page: "abc", pageSize: 9999, stage: "NOPE", sortDir: "sideways" });
    expect(result.data).toMatchObject({ page: 1, pageSize: 10, total: 1 });
  });
});

describe("getOpportunity", () => {
  it("is NOT_FOUND for an unknown id and a validation error for a bad one", async () => {
    expect(isError(await getOpportunity("missing"), "NOT_FOUND")).toBe(true);
    expect(isError(await getOpportunity(""), "VALIDATION")).toBe(true);
  });

  it("returns fields, comments and a chronological timeline of everything that happened", async () => {
    signInAs("admin");
    const created = await createOpportunity({
      companyName: "Timeline Co",
      requestedAmount: "10",
      currency: "EUR",
      submissionDate: "2026-09-01",
      description: "d",
    });
    const id = created.data?.id ?? "";
    await addComment({ opportunityId: id, content: "First" });
    await changeStage({ opportunityId: id, targetStage: "UNDER_REVIEW" });

    const { data } = await getOpportunity(id);
    expect(data).toMatchObject({ companyName: "Timeline Co", currency: "EUR", requestedAmount: "10.00", stage: "UNDER_REVIEW" });
    expect(data?.createdBy.id).toBe(USERS.admin.id);
    expect(data?.comments.map((c) => c.content)).toEqual(["First"]);
    expect(data?.timeline.map((t) => t.type)).toEqual(["CREATION", "COMMENT_ADDED", "STAGE_CHANGE"]);
    const times = data?.timeline.map((t) => t.createdAt) ?? [];
    expect(times).toEqual([...times].sort());
  });
});

describe("listReviewers", () => {
  it("returns only users with the REVIEWER role", async () => {
    const { data } = await listReviewers();
    expect(data).toEqual([
      { id: USERS.reviewer2.id, name: USERS.reviewer2.name },
      { id: USERS.reviewer1.id, name: USERS.reviewer1.name },
    ]);
  });
});
