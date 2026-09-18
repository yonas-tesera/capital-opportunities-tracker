import { vi } from "vitest";

// Sessions are faked at the NextAuth boundary; `getVerifiedSession` and the DB re-check run for real.
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
