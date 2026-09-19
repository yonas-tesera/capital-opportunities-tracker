"use client";

import { ErrorState } from "@/components/ui/error-state";

// Last-resort boundary for unexpected render errors; details stay in the server logs.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState message="An unexpected error occurred while loading this page." onRetry={reset} />;
}
