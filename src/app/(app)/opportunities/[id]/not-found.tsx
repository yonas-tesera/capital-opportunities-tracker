import Link from "next/link";

export default function OpportunityNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white px-4 py-10 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Opportunity not found</h1>
      <p className="mt-2 text-sm text-slate-600">It may have been removed, or the link is incorrect.</p>
      <Link
        href="/opportunities"
        className="mt-4 inline-flex rounded-md bg-indigo-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800"
      >
        Back to opportunities
      </Link>
    </div>
  );
}
