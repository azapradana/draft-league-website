import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackEditors, type PackEditorTier } from "./pack-editors";

export default async function AdminPackPage({
  params,
}: {
  params: Promise<{ id: string; packId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { id: tournamentId, packId } = await params;
  const pack = await prisma.pack.findFirst({
    where: { id: packId, tournamentId },
    include: {
      tournament: { select: { name: true } },
      tiers: { orderBy: { id: "asc" } },
      entries: { select: { speciesDex: true, tierId: true } },
    },
  });
  if (!pack) {
    notFound();
  }

  const species = await prisma.species.findMany({
    orderBy: [{ dex: "asc" }],
    select: { dex: true, name: true },
  });
  const tiers: PackEditorTier[] = pack.tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    weight: tier.weight.toString(),
    color: tier.color,
  }));
  const entries = pack.entries.map((entry) => ({
    speciesDex: entry.speciesDex,
    tierId: entry.tierId,
  }));

  return (
    <main className="min-h-screen bg-[#070D24] px-6 py-10 text-[#EEF2FF] sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/admin/t/${tournamentId}`}
          className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]"
        >
          ← Back to tournament admin
        </Link>

        <header className="mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            {pack.tournament.name} · Pack editor
          </p>
          <h1 className="mt-2 text-3xl font-bold">{pack.name}</h1>
          <p className="mt-2 text-[#9FB0E6]">
            Configure this pack’s rarity odds and the Pokémon that can appear in it.
          </p>
        </header>

        <PackEditors
          packId={pack.id}
          initialTiers={tiers}
          initialEntries={entries}
          species={species}
        />
      </div>
    </main>
  );
}
