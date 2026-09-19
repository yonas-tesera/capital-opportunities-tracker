import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { Providers } from "@/components/providers";
import { authOptions } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <Providers>
      <a
        href="#main"
        className="sr-only rounded-md bg-white px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10"
      >
        Skip to main content
      </a>
      <AppHeader name={session.user.name ?? session.user.email ?? "User"} role={session.user.role} />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </Providers>
  );
}
