import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RosterManager, { type CollectionSpecies } from "./roster-manager";

export default async function TournamentRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}/roster`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      rostersLocked: true,
      participants: {
        where: { userId: session.user.id },
        select: {
          status: true,
          ownedPokemon: {
            select: {
              tierName: true,
              tierColor: true,
              species: {
                select: { dex: true, name: true, isMega: true, imageUrl: true },
              },
              purchase: {
                select: {
                  pack: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          roster: { select: { speciesIds: true } },
        },
      },
    },
  });
  if (!tournament) notFound();

  const participant = tournament.participants[0];
  if (participant?.status !== "APPROVED") {
    return (
      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <h2 className="text-2xl font-bold">Your collection and roster</h2>
        <p className="mt-3 text-[#9FB0E6]">
          An admin must approve your place in this tournament before you can manage a roster.
        </p>
      </section>
    );
  }

  const legacyOwned = participant.ownedPokemon.filter(
    (owned) => owned.tierName === null || owned.tierColor === null,
  );
  const legacyEntries =
    legacyOwned.length > 0
      ? await prisma.packEntry.findMany({
          where: {
            packId: { in: [...new Set(legacyOwned.map((owned) => owned.purchase.pack.id))] },
            speciesDex: { in: [...new Set(legacyOwned.map((owned) => owned.species.dex))] },
          },
          select: {
            packId: true,
            speciesDex: true,
            tier: { select: { name: true, color: true } },
          },
        })
      : [];
  const legacyTierByPackSpecies = new Map(
    legacyEntries.map((entry) => [
      `${entry.packId}:${entry.speciesDex}`,
      { name: entry.tier.name, color: entry.tier.color },
    ]),
  );

  const counts = new Map<
    number,
    CollectionSpecies & {
      quantity: number;
      sources: Map<
        string,
        {
          packName: string;
          tierName: string;
          tierColor: string;
          quantity: number;
          tierIsInferred: boolean;
        }
      >;
    }
  >();
  for (const owned of participant.ownedPokemon) {
    const dex = owned.species.dex;
    const current = counts.get(dex) ?? {
      ...owned.species,
      quantity: 0,
      sources: new Map(),
    };
    current.quantity += 1;
    const inferredTier = legacyTierByPackSpecies.get(`${owned.purchase.pack.id}:${dex}`);
    const tierName = owned.tierName ?? inferredTier?.name ?? "Tier not recorded";
    const tierColor = owned.tierColor ?? inferredTier?.color ?? "#9FB0E6";
    const tierIsInferred =
      (owned.tierName === null || owned.tierColor === null) && inferredTier !== undefined;
    const sourceKey = `${owned.purchase.pack.id}:${tierName}:${tierColor}:${tierIsInferred}`;
    const source = current.sources.get(sourceKey);
    if (source) source.quantity += 1;
    else {
      current.sources.set(sourceKey, {
        packName: owned.purchase.pack.name,
        tierName,
        tierColor,
        quantity: 1,
        tierIsInferred,
      });
    }
    counts.set(dex, current);
  }
  const collection = [...counts.values()]
    .map(({ sources, ...entry }) => ({
      ...entry,
      sources: [...sources.values()].sort(
        (a, b) => a.packName.localeCompare(b.packName) || a.tierName.localeCompare(b.tierName),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <RosterManager
      tournamentId={id}
      collection={collection}
      initialRoster={participant.roster?.speciesIds ?? []}
      locked={tournament.rostersLocked}
    />
  );
}
