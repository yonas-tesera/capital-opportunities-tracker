"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  archiveOpportunity,
  assignReviewer,
  changeStage,
  restoreOpportunity,
  updateOpportunity,
} from "@/actions/opportunity-mutations";
import type { OpportunityDetailDTO } from "@/domain/dto";
import type { Role, Stage } from "@/domain/enums";
import { can } from "@/domain/rbac";
import { getAllowedTransitions } from "@/domain/state-machine";
import { OpportunityForm } from "@/components/opportunity-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Modal } from "@/components/ui/modal";
import { STAGE_LABELS } from "@/components/ui/stage-badge";
import { fetchReviewers, keys } from "@/lib/fetchers";
import type { UseAction } from "@/lib/use-action";
import { useOpportunityAction } from "./use-opportunity-action";

interface StageAction {
  label: string;
  variant: "primary" | "secondary" | "danger";
  /** Terminal stages cannot be left, so they need a confirmation. */
  terminal: boolean;
  confirmText: string;
}

const STAGE_ACTIONS: Record<Exclude<Stage, "DRAFT">, StageAction> = {
  UNDER_REVIEW: { label: "Submit for review", variant: "primary", terminal: false, confirmText: "" },
  APPROVED: {
    label: "Approve",
    variant: "primary",
    terminal: true,
    confirmText: "The opportunity will be marked Approved. This is final: no further stage changes are possible.",
  },
  REJECTED: {
    label: "Reject",
    variant: "danger",
    terminal: true,
    confirmText: "The opportunity will be marked Rejected. This is final: no further stage changes are possible.",
  },
};

export function ActionsPanel({ opportunity, role }: { opportunity: OpportunityDetailDTO; role: Role }) {
  const { id, isArchived, stage } = opportunity;
  const [editing, setEditing] = useState(false);
  // Dialog targets stay put while a dialog closes, so its text does not change as fresh data arrives.
  const [confirmStage, setConfirmStage] = useState<Exclude<Stage, "DRAFT"> | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [archiveIntent, setArchiveIntent] = useState<"archive" | "restore">("archive");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const edit = useOpportunityAction(id, updateOpportunity, () => setEditing(false));
  const stageChange = useOpportunityAction(id, changeStage, () => setStageDialogOpen(false));
  const archive = useOpportunityAction(id, archiveOpportunity, () => setArchiveDialogOpen(false));
  const restore = useOpportunityAction(id, restoreOpportunity, () => setArchiveDialogOpen(false));
  const assign = useOpportunityAction(id, assignReviewer);

  // Only one mutation at a time from this panel.
  const busy = edit.pending || stageChange.pending || archive.pending || restore.pending || assign.pending;

  const canEdit = can(role, "EDIT") && !isArchived;
  const canAssign = can(role, "ASSIGN_REVIEWER") && !isArchived;
  const nextStages = can(role, "CHANGE_STAGE") && !isArchived ? getAllowedTransitions(stage) : [];
  const canToggleArchive = isArchived ? can(role, "RESTORE") : can(role, "ARCHIVE");

  const hasActions = canEdit || canAssign || nextStages.length > 0 || canToggleArchive;
  if (!hasActions) return null;

  const archiveAction = archiveIntent === "restore" ? restore : archive;
  const inlineError = stageDialogOpen ? null : stageChange.error;

  function runStage(target: Exclude<Stage, "DRAFT">) {
    void stageChange.run({ opportunityId: id, targetStage: target });
  }

  return (
    <section aria-labelledby="actions-heading" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="actions-heading" className="text-lg font-semibold text-slate-900">
        Actions
      </h2>

      {nextStages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nextStages.map((target) => {
            if (target === "DRAFT") return null;
            const action = STAGE_ACTIONS[target];
            return (
              <LoadingButton
                key={target}
                variant={action.variant}
                disabled={busy}
                loading={stageChange.pending && !action.terminal}
                loadingText="Updating…"
                onClick={() => {
                  stageChange.clearError();
                  if (action.terminal) {
                    setConfirmStage(target);
                    setStageDialogOpen(true);
                  } else runStage(target);
                }}
              >
                {action.label}
              </LoadingButton>
            );
          })}
        </div>
      )}
      {inlineError && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {inlineError}
        </p>
      )}

      {canAssign && <ReviewerAssign opportunity={opportunity} assign={assign} disabled={busy} />}

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <LoadingButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              edit.clearError();
              setEditing(true);
            }}
          >
            Edit details
          </LoadingButton>
        )}
        {canToggleArchive && (
          <LoadingButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              const intent = isArchived ? "restore" : "archive";
              (intent === "restore" ? restore : archive).clearError();
              setArchiveIntent(intent);
              setArchiveDialogOpen(true);
            }}
          >
            {isArchived ? "Restore opportunity" : "Archive opportunity"}
          </LoadingButton>
        )}
      </div>

      {confirmStage && (
        <ConfirmDialog
          open={stageDialogOpen}
          title={`${STAGE_ACTIONS[confirmStage].label} this opportunity?`}
          description={STAGE_ACTIONS[confirmStage].confirmText}
          confirmLabel={`${STAGE_ACTIONS[confirmStage].label} (${STAGE_LABELS[confirmStage]})`}
          destructive={confirmStage === "REJECTED"}
          pending={stageChange.pending}
          error={stageChange.error}
          onConfirm={() => runStage(confirmStage)}
          onClose={() => {
            stageChange.clearError();
            setStageDialogOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={archiveDialogOpen}
        title={archiveIntent === "restore" ? "Restore this opportunity?" : "Archive this opportunity?"}
        description={
          archiveIntent === "restore"
            ? "It will become editable again and appear in the default list."
            : "It becomes read-only and is hidden from the default list. You can restore it later."
        }
        confirmLabel={archiveIntent === "restore" ? "Restore" : "Archive"}
        destructive={archiveIntent === "archive"}
        pending={archiveAction.pending}
        error={archiveAction.error}
        onConfirm={() => void archiveAction.run({ opportunityId: id })}
        onClose={() => {
          archiveAction.clearError();
          setArchiveDialogOpen(false);
        }}
      />

      <Modal
        open={editing}
        title="Edit details"
        description="Company, amount, date and description."
        pending={edit.pending}
        onClose={() => setEditing(false)}
      >
        {editing && (
          <OpportunityForm
            initial={{
              companyName: opportunity.companyName,
              requestedAmount: opportunity.requestedAmount,
              currency: opportunity.currency,
              submissionDate: opportunity.submissionDate.slice(0, 10),
              description: opportunity.description,
            }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            pending={edit.pending}
            error={edit.error}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => void edit.run({ id, ...values })}
          />
        )}
      </Modal>
    </section>
  );
}

function ReviewerAssign({
  opportunity,
  assign,
  disabled,
}: {
  opportunity: OpportunityDetailDTO;
  assign: UseAction<[unknown], OpportunityDetailDTO>;
  disabled: boolean;
}) {
  const reviewers = useSWR(keys.reviewers(), fetchReviewers);
  const currentId = opportunity.assignedReviewer?.id ?? "";
  // Local choice, reset to the saved value whenever the saved reviewer changes.
  const [choice, setChoice] = useState<{ savedId: string; value: string }>({ savedId: currentId, value: currentId });
  const value = choice.savedId === currentId ? choice.value : currentId;

  return (
    <div className="space-y-2">
      <label htmlFor="reviewer-select" className="block text-sm font-medium text-slate-900">
        Assigned reviewer
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id="reviewer-select"
          value={value}
          onChange={(event) => {
            assign.clearError();
            setChoice({ savedId: currentId, value: event.target.value });
          }}
          disabled={disabled || reviewers.isLoading || Boolean(reviewers.error)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 sm:max-w-xs"
        >
          <option value="">Unassigned</option>
          {reviewers.data?.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.id}>
              {reviewer.name}
            </option>
          ))}
        </select>
        <LoadingButton
          variant="secondary"
          loading={assign.pending}
          loadingText="Saving…"
          disabled={disabled || value === currentId}
          onClick={() => void assign.run({ opportunityId: opportunity.id, reviewerId: value === "" ? null : value })}
        >
          Save reviewer
        </LoadingButton>
      </div>
      {reviewers.error && (
        <p role="alert" className="text-sm text-red-700">
          Could not load reviewers.{" "}
          <button type="button" onClick={() => void reviewers.mutate()} className="font-medium underline">
            Retry
          </button>
        </p>
      )}
      {assign.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {assign.error}
        </p>
      )}
    </div>
  );
}
