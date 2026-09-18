import path from "node:path";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/test-db.mjs";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.resolve("src")}/` },
      { find: "server-only", replacement: path.resolve("test/server-only-stub.ts") },
    ],
  },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Integration tests share one database.
    fileParallelism: false,
    env: { DATABASE_URL: testDatabaseUrl(), NEXTAUTH_SECRET: "test-secret" },
  },
});
