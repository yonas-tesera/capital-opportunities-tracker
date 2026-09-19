"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/domain/enums";
import { RoleBadge } from "@/components/ui/role-badge";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/", label: "Dashboard", matches: (path: string) => path === "/" },
  { href: "/opportunities", label: "Opportunities", matches: (path: string) => path.startsWith("/opportunities") },
] as const;

export function AppHeader({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded text-base font-semibold text-slate-900">
          Capital Opportunities Tracker
        </Link>
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-1">
            {NAV.map((item) => {
              const current = item.matches(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`block rounded-md px-3 py-1.5 text-sm font-medium ${
                      current ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-900">{name}</span>
            <RoleBadge role={role} />
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
