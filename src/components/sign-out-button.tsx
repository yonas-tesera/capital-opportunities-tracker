"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <LoadingButton variant="secondary" className="py-1.5" loading={pending} loadingText="Signing out…" onClick={handleClick}>
      Sign out
    </LoadingButton>
  );
}
