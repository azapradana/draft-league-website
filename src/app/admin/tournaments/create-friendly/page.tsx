import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureCoreGroup } from "@/lib/groups";
import { CreateFriendlyForm } from "./create-friendly-form";

export default async function CreateFriendlyMatchPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const core = await ensureCoreGroup();

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="text-sm text-[#9FB0E6] hover:text-[#F5C542]">
          ← Back to tournaments
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
          Admin workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Create friendly match</h1>
        <p className="mb-8 mt-2 text-sm text-[#9FB0E6]">
          Set up an N vs N group war between {core.name} and a rival group.
        </p>
        <CreateFriendlyForm coreGroupName={core.name} />
      </div>
    </main>
  );
}
