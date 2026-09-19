"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  /** While pending, Esc and backdrop clicks do not close the modal. */
  pending?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Built on the native <dialog>: showModal() gives a focus trap, an inert page behind it,
 * Esc to close and focus restore to the trigger.
 */
export function Modal({ open, title, description, pending = false, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg p-0 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-sm text-slate-600">
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
