import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getOpportunity } from "@/actions/opportunities";
import { isError } from "@/domain/result";
import { authOptions } from "@/lib/auth";
import { OpportunityDetailView } from "./detail-view";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const initial = await getOpportunity(id);
  if (isError(initial, "NOT_FOUND") || isError(initial, "VALIDATION")) notFound();

  // If the first load failed for another reason the view fetches again and shows its own error state.
  return <OpportunityDetailView id={id} role={session.user.role} initial={initial.data} />;
}
