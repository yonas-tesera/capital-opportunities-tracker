"use client";

import type { ReactNode } from "react";
import { LoadingButton } from "./loading-button";
import { Modal } from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  /** Error from the confirmed action, shown inside the dialog. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  error,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} description={description} pending={pending} onClose={onClose}>
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LoadingButton variant="secondary" onClick={onClose} disabled={pending} autoFocus>
          {cancelLabel}
        </LoadingButton>
        <LoadingButton variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </LoadingButton>
      </div>
    </Modal>
  );
}
