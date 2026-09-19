import type { ReactNode } from "react";

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
