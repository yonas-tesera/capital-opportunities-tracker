import type { Stage } from "@/domain/enums";

export const STAGE_LABELS: Record<Stage, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STAGE_STYLES: Record<Stage, string> = {
  DRAFT: "bg-slate-100 text-slate-800 ring-slate-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-900 ring-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  REJECTED: "bg-red-100 text-red-900 ring-red-300",
};

// The text label carries the meaning; colour only reinforces it.
export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STAGE_STYLES[stage]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
