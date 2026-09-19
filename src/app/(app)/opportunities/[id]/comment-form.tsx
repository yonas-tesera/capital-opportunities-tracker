"use client";

import { useId, useState, type FormEvent } from "react";
import { addComment } from "@/actions/comments";
import { addCommentSchema } from "@/domain/schemas";
import { LoadingButton } from "@/components/ui/loading-button";
import { useOpportunityAction } from "./use-opportunity-action";

const MAX = 1000;

export function CommentForm({ opportunityId }: { opportunityId: string }) {
  const uid = useId();
  const [content, setContent] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { run, pending, error, clearError } = useOpportunityAction(opportunityId, addComment);

  const length = content.trim().length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setAdded(false);

    // Client-side hint only: the Server Action validates again.
    const parsed = addCommentSchema.safeParse({ opportunityId, content });
    if (!parsed.success) {
      setHint(parsed.error.issues[0]?.message ?? "Comment is invalid.");
      return;
    }
    setHint(null);
    clearError();

    const result = await run({ opportunityId, content });
    if (result.success) {
      setContent("");
      setAdded(true);
    }
  }

  const message = hint ?? error;

  return (
    <section aria-labelledby={`${uid}-heading`} className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id={`${uid}-heading`} className="text-lg font-semibold text-slate-900">
        Add a comment
      </h2>
      <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-2">
        <label htmlFor={`${uid}-content`} className="sr-only">
          Comment
        </label>
        <textarea
          id={`${uid}-content`}
          rows={3}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setHint(null);
            setAdded(false);
          }}
          disabled={pending}
          aria-invalid={message !== null}
          aria-describedby={`${uid}-count ${message ? `${uid}-error` : ""}`.trim()}
          placeholder="Write a comment…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 aria-[invalid=true]:border-red-600"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${uid}-count`} className={`text-xs ${length > MAX ? "font-medium text-red-700" : "text-slate-600"}`}>
            {length}/{MAX} characters
          </p>
          <LoadingButton type="submit" loading={pending} loadingText="Posting…">
            Post comment
          </LoadingButton>
        </div>
        {message && (
          <p id={`${uid}-error`} role="alert" className="text-sm font-medium text-red-700">
            {message}
          </p>
        )}
        <p role="status" className="min-h-4 text-sm text-emerald-800">
          {added ? "Comment added." : ""}
        </p>
      </form>
    </section>
  );
}
