import { loadEnv } from "vite";

/** Integration tests use a separate database (`<name>_test`) so the dev data is never touched. */
export function testDatabaseUrl(): string {
  const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };
  const explicit = env.TEST_DATABASE_URL;
  if (explicit) return explicit;
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL (or TEST_DATABASE_URL) must be set to run the tests.");

  const url = new URL(env.DATABASE_URL);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export function databaseName(url: string): string {
  const name = new URL(url).pathname.slice(1);
  if (!/^[A-Za-z0-9_]+_test$/.test(name)) {
    throw new Error(`Refusing to run tests against "${name}": the database name must end with _test.`);
  }
  return name;
}
