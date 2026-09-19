"use client";

import { createOpportunity } from "@/actions/opportunity-mutations";
import { Modal } from "@/components/ui/modal";
import { OpportunityForm, todayIsoDate } from "@/components/opportunity-form";
import { isOpportunitiesKey, keys } from "@/lib/fetchers";
import { useAction } from "@/lib/use-action";

interface CreateOpportunityDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (companyName: string) => void;
}

export function CreateOpportunityDialog({ open, onClose, onCreated }: CreateOpportunityDialogProps) {
  const { run, pending, error, clearError } = useAction(createOpportunity, {
    // A new opportunity changes every list page and the dashboard numbers.
    revalidate: () => [isOpportunitiesKey, keys.dashboard()],
  });

  function close() {
    clearError();
    onClose();
  }

  return (
    <Modal open={open} title="New opportunity" description="Opportunities start as drafts." pending={pending} onClose={close}>
      {open && (
        <OpportunityForm
          initial={{ companyName: "", requestedAmount: "", currency: "USD", submissionDate: todayIsoDate(), description: "" }}
          submitLabel="Create opportunity"
          pendingLabel="Creating…"
          pending={pending}
          error={error}
          onCancel={close}
          onSubmit={async (values) => {
            const result = await run(values);
            if (result.success) {
              onCreated(values.companyName.trim());
              close();
            }
          }}
        />
      )}
    </Modal>
  );
}
