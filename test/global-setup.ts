import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { databaseName, testDatabaseUrl } from "./test-db.mjs";

export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const name = databaseName(url);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const existing = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
