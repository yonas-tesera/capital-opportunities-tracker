"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { CURRENCIES } from "@/domain/enums";
import { createOpportunitySchema } from "@/domain/schemas";
import { LoadingButton } from "@/components/ui/loading-button";

const DESCRIPTION_MAX = 500;
const FIELDS = ["companyName", "requestedAmount", "currency", "submissionDate", "description"] as const;

export type OpportunityFieldName = (typeof FIELDS)[number];
export type OpportunityFormValues = Record<OpportunityFieldName, string>;
type FieldErrors = Partial<Record<OpportunityFieldName, string>>;

const isFieldName = (value: unknown): value is OpportunityFieldName => FIELDS.some((field) => field === value);

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:opacity-60 aria-[invalid=true]:border-red-600";

export const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

interface OpportunityFormProps {
  initial: OpportunityFormValues;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Error string returned by the Server Action. */
  error: string | null;
  onSubmit: (values: OpportunityFormValues) => void;
  onCancel: () => void;
}

/** Shared by create and edit. Client-side checks are hints only: the Server Action validates again. */
export function OpportunityForm({ initial, submitLabel, pendingLabel, pending, error, onSubmit, onCancel }: OpportunityFormProps) {
  const uid = useId();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [description, setDescription] = useState(initial.description);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(FIELDS.map((field) => [field, String(form.get(field) ?? "")])) as OpportunityFormValues;

    const hints = createOpportunitySchema.safeParse(values);
    if (!hints.success) {
      const errors: FieldErrors = {};
      for (const issue of hints.error.issues) {
        const field = issue.path[0];
        if (isFieldName(field) && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSubmit(values);
  }

  const id = (name: OpportunityFieldName) => `${uid}-${name}`;
  const control = (name: OpportunityFieldName, hasHint = false) => ({
    id: id(name),
    name,
    disabled: pending,
    className: inputClass,
    "aria-invalid": Boolean(fieldErrors[name]),
    "aria-describedby": [fieldErrors[name] ? `${id(name)}-error` : null, hasHint ? `${id(name)}-hint` : null].filter(Boolean).join(" ") || undefined,
  });
  const field = (name: OpportunityFieldName, label: string, children: ReactNode, hint?: string) => (
    <div className="space-y-1">
      <label htmlFor={id(name)} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id(name)}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      )}
      {fieldErrors[name] && (
        <p id={`${id(name)}-error`} className="text-sm text-red-700">
          {fieldErrors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {field("companyName", "Company name", <input {...control("companyName")} type="text" required maxLength={200} defaultValue={initial.companyName} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "requestedAmount",
          "Requested amount",
          <input {...control("requestedAmount", true)} type="text" inputMode="decimal" required defaultValue={initial.requestedAmount} />,
          "Up to 2 decimal places.",
        )}
        {field(
          "currency",
          "Currency",
          <select {...control("currency")} defaultValue={initial.currency}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>,
        )}
      </div>
      {field("submissionDate", "Submission date", <input {...control("submissionDate")} type="date" required defaultValue={initial.submissionDate} />)}
      {field(
        "description",
        "Description",
        <textarea
          {...control("description", true)}
          rows={4}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />,
        `${description.length}/${DESCRIPTION_MAX} characters`,
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LoadingButton variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </LoadingButton>
        <LoadingButton type="submit" loading={pending} loadingText={pendingLabel}>
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
