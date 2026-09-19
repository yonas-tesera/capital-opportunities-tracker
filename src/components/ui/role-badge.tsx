import type { Role } from "@/domain/enums";

const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", REVIEWER: "Reviewer", VIEWER: "Viewer" };

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900 ring-1 ring-inset ring-indigo-200">
      {ROLE_LABELS[role]}
    </span>
  );
}
