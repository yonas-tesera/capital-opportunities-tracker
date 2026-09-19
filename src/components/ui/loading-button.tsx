import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-700 text-white hover:bg-indigo-800 border-transparent",
  secondary: "bg-white text-slate-900 hover:bg-slate-100 border-slate-300",
  danger: "bg-red-700 text-white hover:bg-red-800 border-transparent",
};

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Replaces the label while loading. */
  loadingText?: string;
  variant?: Variant;
}

export function LoadingButton({
  loading = false,
  loadingText,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
  children,
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}
