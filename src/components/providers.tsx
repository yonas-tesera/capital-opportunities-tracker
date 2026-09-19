"use client";

import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { ERRORS } from "@/domain/result";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Failed loads show an ErrorState with a retry button instead of retrying silently.
        shouldRetryOnError: false,
        onError: (error: unknown) => {
          if (error instanceof Error && error.message === ERRORS.UNAUTHENTICATED) {
            // Ends the session too: a valid cookie for a deleted user would otherwise bounce between / and /login.
            void signOut({ callbackUrl: "/login" });
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
