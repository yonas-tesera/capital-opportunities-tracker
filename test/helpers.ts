import { PrismaClient, type Role, type Stage } from "@prisma/client";
import { vi } from "vitest";
import { getServerSession } from "next-auth";
import { databaseName } from "./test-db.mjs";

databaseName(process.env.DATABASE_URL ?? "");

export const db = new PrismaClient();

export const USERS = {
  admin: { id: "u_admin", email: "admin@test.local", name: "Ada Admin", role: "ADMIN" },
  reviewer1: { id: "u_rev1", email: "rev1@test.local", name: "Rita Reviewer", role: "REVIEWER" },
  reviewer2: { id: "u_rev2", email: "rev2@test.local", name: "Ravi Reviewer", role: "REVIEWER" },
  viewer: { id: "u_viewer", email: "viewer@test.local", name: "Vic Viewer", role: "VIEWER" },
} as const satisfies Record<string, { id: string; email: string; name: string; role: Role }>;

export type UserKey = keyof typeof USERS;

/** ActivityLog is append-only via a trigger, so cleanup disables it just for the wipe. */
export async function resetDatabase(): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('ALTER TABLE "ActivityLog" DISABLE TRIGGER USER');
    await tx.activityLog.deleteMany();
    await tx.$executeRawUnsafe('ALTER TABLE "ActivityLog" ENABLE TRIGGER USER');
    await tx.comment.deleteMany();
    await tx.opportunity.deleteMany();
    await tx.user.deleteMany();
    await tx.user.createMany({ data: Object.values(USERS).map((u) => ({ ...u, passwordHash: "x" })) });
  });
}

/** Signs the given seeded user in for the next action calls; `null` means signed out. */
export function signInAs(user: UserKey | null | { id: string }): void {
  const id = user === null ? null : typeof user === "string" ? USERS[user].id : user.id;
  vi.mocked(getServerSession).mockResolvedValue(id === null ? null : ({ user: { id }, expires: "" } as never));
}

let counter = 0;

export async function makeOpportunity(
  overrides: { stage?: Stage; isArchived?: boolean; assignedReviewerId?: string | null } = {},
): Promise<string> {
  counter += 1;
  const created = await db.opportunity.create({
    data: {
      companyName: `Company ${counter}`,
      requestedAmount: "1000.00",
      currency: "USD",
      submissionDate: new Date("2026-09-01T00:00:00Z"),
      description: "Test opportunity",
      createdById: USERS.admin.id,
      ...overrides,
    },
    select: { id: true },
  });
  return created.id;
}

export const activityFor = (opportunityId: string) =>
  db.activityLog.findMany({ where: { opportunityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

/** Makes every ActivityLog insert fail, to prove the surrounding change rolls back with it. */
export async function failActivityInserts<T>(run: () => Promise<T>): Promise<T> {
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION test_fail_activity() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$ LANGUAGE plpgsql`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER test_fail_activity BEFORE INSERT ON "ActivityLog" FOR EACH ROW EXECUTE FUNCTION test_fail_activity()`,
  );
  try {
    return await run();
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER test_fail_activity ON "ActivityLog"');
  }
}
