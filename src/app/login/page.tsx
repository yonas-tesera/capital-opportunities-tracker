import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-indigo-800">Capital Opportunities Tracker</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">Use your work email and password.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
