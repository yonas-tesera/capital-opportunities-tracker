"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

const INVALID_CREDENTIALS = "Invalid email or password";

// Only same-site relative paths are allowed, to avoid open redirects.
function safeCallbackUrl(value: string | null): string {
  return value !== null && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const router = useRouter();
  const callbackUrl = safeCallbackUrl(useSearchParams().get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });

    if (result?.ok) {
      router.replace(callbackUrl);
      router.refresh();
      return;
    }
    setError(INVALID_CREDENTIALS);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div role="alert" aria-live="assertive" className="min-h-6 text-sm text-red-700">
        {error}
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={submitting}
          aria-invalid={error !== null}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-60"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={submitting}
          aria-invalid={error !== null}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
