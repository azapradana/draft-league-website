import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PokemonArtwork from "../pokemon-artwork";

export default async function TournamentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}/results`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!tournament) notFound();

  const participants = await prisma.participant.findMany({
    where: { tournamentId: id, status: "APPROVED" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      coins: true,
      user: { select: { username: true, name: true, email: true } },
      roster: { select: { speciesIds: true } },
      ownedPokemon: {
        orderBy: [{ purchase: { timestamp: "asc" } }, { id: "asc" }],
        select: {
          species: {
            select: { dex: true, name: true, isMega: true, imageUrl: true },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Tournament results
        </p>
        <h2 className="mt-2 text-3xl font-bold">{tournament.name}</h2>
        <p className="mt-3 max-w-2xl text-[#9FB0E6]">
          All approved players, their remaining coins, rosters, and full collections.
        </p>
      </section>

      {participants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#243775] p-6 text-[#9FB0E6]">
          No players have been approved for this tournament yet.
        </p>
      ) : (
        <div className="space-y-5">
          {participants.map((participant) => {
            const playerName =
              participant.user.name ??
              participant.user.username ??
              participant.user.email ??
              "Player";
            const ownedByDex = new Map(
              participant.ownedPokemon.map((owned) => [owned.species.dex, owned.species]),
            );
            const rosterSpecies = (participant.roster?.speciesIds ?? [])
              .map((dex) => ownedByDex.get(dex))
              .filter((species) => species !== undefined);

            return (
              <article
                key={participant.id}
                className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">{playerName}</h3>
                    <p className="mt-1 text-sm text-[#9FB0E6]">
                      {participant.ownedPokemon.length} Pokémon collected
                    </p>
                  </div>
                  <p className="rounded-lg bg-[#070D24] px-3 py-2 font-bold text-[#F5C542]">
                    {participant.coins.toLocaleString()} coins
                  </p>
                </div>

                <section className="mt-5">
                  <h4 className="text-sm font-semibold text-[#EEF2FF]">Roster</h4>
                  {rosterSpecies.length === 0 ? (
                    <p className="mt-2 text-sm text-[#9FB0E6]">No roster selected.</p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-3">
                      {rosterSpecies.map((species) => (
                        <li
                          key={species.dex}
                          className="flex flex-col items-center gap-1 rounded-xl border border-[#243775] bg-[#070D24] p-2 text-center"
                        >
                          <PokemonArtwork species={species} className="h-16 w-16" />
                          <span className="max-w-24 text-xs font-semibold">{species.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <details className="mt-5 rounded-xl border border-[#243775] bg-[#070D24] p-4">
                  <summary className="cursor-pointer font-semibold text-[#EEF2FF]">
                    Full pull list ({participant.ownedPokemon.length})
                  </summary>
                  {participant.ownedPokemon.length === 0 ? (
                    <p className="mt-3 text-sm text-[#9FB0E6]">No Pokémon collected yet.</p>
                  ) : (
                    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {participant.ownedPokemon.map((owned, index) => (
                        <li
                          key={`${owned.species.dex}-${index}`}
                          className="flex items-center gap-3 rounded-xl border border-[#243775] bg-[#0C1638] p-3"
                        >
                          <PokemonArtwork species={owned.species} className="h-12 w-12" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {owned.species.name}
                            </span>
                            <span className="block text-xs text-[#9FB0E6]">
                              #{owned.species.dex}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
