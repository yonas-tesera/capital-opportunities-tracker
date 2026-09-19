import { getServerSession } from "next-auth";
import { can } from "@/domain/rbac";
import { authOptions } from "@/lib/auth";
import { OpportunitiesView } from "./opportunities-view";

export default async function OpportunitiesPage() {
  const session = await getServerSession(authOptions);
  // Only decides whether to render the button; createOpportunity enforces the permission itself.
  const canCreate = session ? can(session.user.role, "CREATE") : false;

  return <OpportunitiesView canCreate={canCreate} />;
}
