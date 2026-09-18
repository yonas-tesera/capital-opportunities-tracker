import { getServerSession } from "next-auth";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";

// Placeholder: proves the session works. Replaced by the dashboard in the UI phase.
export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Capital Opportunities Tracker</h1>
      <p>
        Signed in as <strong>{session?.user.name}</strong> ({session?.user.role})
      </p>
      <SignOutButton />
    </main>
  );
}
