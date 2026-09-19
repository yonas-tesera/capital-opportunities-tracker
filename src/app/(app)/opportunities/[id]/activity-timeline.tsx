import type { ReactNode } from "react";
import type { ActivityTimelineItemDTO, OpportunityDetailDTO } from "@/domain/dto";
import type { ActivityType } from "@/domain/enums";
import { StageBadge } from "@/components/ui/stage-badge";
import { formatDateTime, formatFullDateTime } from "@/lib/format";

const ICON_PATHS: Record<ActivityType, ReactNode> = {
  CREATION: <path d="M12 5v14M5 12h14" />,
  STAGE_CHANGE: <path d="M5 12h14M13 6l6 6-6 6" />,
  REVIEWER_ASSIGNMENT: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  COMMENT_ADDED: <path d="M4 5h16v11H9l-5 4z" />,
  ARCHIVED: (
    <>
      <path d="M3 5h18v4H3z" />
      <path d="M5 9v10h14V9M10 13h4" />
    </>
  ),
  RESTORED: <path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" />,
};

const LABELS: Record<ActivityType, string> = {
  CREATION: "Created",
  STAGE_CHANGE: "Stage changed",
  REVIEWER_ASSIGNMENT: "Reviewer",
  COMMENT_ADDED: "Comment",
  ARCHIVED: "Archived",
  RESTORED: "Restored",
};

const ICON_STYLES: Record<ActivityType, string> = {
  CREATION: "bg-emerald-100 text-emerald-900",
  STAGE_CHANGE: "bg-amber-100 text-amber-900",
  REVIEWER_ASSIGNMENT: "bg-indigo-100 text-indigo-900",
  COMMENT_ADDED: "bg-sky-100 text-sky-900",
  ARCHIVED: "bg-slate-200 text-slate-900",
  RESTORED: "bg-teal-100 text-teal-900",
};

function Description({ item, commentText }: { item: ActivityTimelineItemDTO; commentText: string | undefined }) {
  const actor = <strong className="font-medium">{item.actor.name}</strong>;
  switch (item.type) {
    case "CREATION":
      return (
        <>
          {actor} created this opportunity as <StageBadge stage={item.metadata.stage} />
        </>
      );
    case "STAGE_CHANGE":
      return (
        <>
          {actor} moved the stage from <StageBadge stage={item.metadata.previousStage} /> to{" "}
          <StageBadge stage={item.metadata.newStage} />
        </>
      );
    case "REVIEWER_ASSIGNMENT": {
      const { previousReviewer, newReviewer } = item.metadata;
      if (newReviewer && previousReviewer) {
        return (
          <>
            {actor} changed the reviewer from <strong className="font-medium">{previousReviewer.name}</strong> to{" "}
            <strong className="font-medium">{newReviewer.name}</strong>
          </>
        );
      }
      if (newReviewer) {
        return (
          <>
            {actor} assigned <strong className="font-medium">{newReviewer.name}</strong> as reviewer
          </>
        );
      }
      return (
        <>
          {actor} unassigned <strong className="font-medium">{previousReviewer?.name ?? "the reviewer"}</strong>
        </>
      );
    }
    case "COMMENT_ADDED":
      return (
        <>
          {actor} commented
          <span className="mt-1 block whitespace-pre-wrap break-words rounded-md bg-slate-50 px-3 py-2 text-slate-900 ring-1 ring-inset ring-slate-200">
            {commentText ?? "Comment unavailable."}
          </span>
        </>
      );
    case "ARCHIVED":
      return <>{actor} archived this opportunity</>;
    case "RESTORED":
      return <>{actor} restored this opportunity</>;
  }
}

/** Read-only, oldest first. Comment text comes from the comment list, keyed by the id stored in the log. */
export function ActivityTimeline({ opportunity }: { opportunity: OpportunityDetailDTO }) {
  const commentsById = new Map(opportunity.comments.map((comment) => [comment.id, comment.content]));

  return (
    <section aria-labelledby="timeline-heading" className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="timeline-heading" className="text-lg font-semibold text-slate-900">
        Activity
      </h2>
      <ol className="mt-4 space-y-5">
        {opportunity.timeline.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${ICON_STYLES[item.type]}`}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICON_PATHS[item.type]}
              </svg>
            </span>
            <div className="min-w-0 flex-1 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase text-slate-600">
                {LABELS[item.type]} ·{" "}
                <time dateTime={item.createdAt} title={formatFullDateTime(item.createdAt)}>
                  {formatDateTime(item.createdAt)}
                </time>
              </p>
              <div className="mt-0.5 break-words">
                <Description item={item} commentText={item.type === "COMMENT_ADDED" ? commentsById.get(item.metadata.commentId) : undefined} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
