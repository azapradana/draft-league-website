import { prisma } from "@/lib/prisma";

export async function getMatchRoomData({
  tournamentId,
  matchId,
  userId,
  isAdmin,
}: {
  tournamentId: string;
  matchId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, tournamentId },
    select: {
      id: true,
      roundNumber: true,
      status: true,
      winnerId: true,
      player1Vote: true,
      player2Vote: true,
      tournament: { select: { name: true } },
      player1: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              group: { select: { name: true, logoUrl: true, isCore: true } },
            },
          },
          roster: { select: { speciesIds: true } },
        },
      },
      player2: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              group: { select: { name: true, logoUrl: true, isCore: true } },
            },
          },
          roster: { select: { speciesIds: true } },
        },
      },
    },
  });

  if (!match) {
    return null;
  }
  if (
    !isAdmin &&
    match.player1?.user.id !== userId &&
    match.player2?.user.id !== userId
  ) {
    return null;
  }

  type MatchParticipant = NonNullable<NonNullable<typeof match>["player1"]>;
  const participantIds = [match.player1?.id, match.player2?.id].filter(
    (participantId): participantId is string => participantId !== undefined,
  );
  const speciesIds = [
    ...new Set([
      ...(match.player1?.roster?.speciesIds ?? []),
      ...(match.player2?.roster?.speciesIds ?? []),
    ]),
  ];
  const [species, ownedPokemon] = await Promise.all([
    speciesIds.length > 0
      ? prisma.species.findMany({
          where: { dex: { in: speciesIds } },
          select: { dex: true, name: true, isMega: true, imageUrl: true, types: true },
        })
      : [],
    participantIds.length > 0 && speciesIds.length > 0
      ? prisma.ownedPokemon.findMany({
          where: {
            participantId: { in: participantIds },
            speciesDex: { in: speciesIds },
          },
          select: {
            participantId: true,
            speciesDex: true,
            tierName: true,
            tierColor: true,
            purchase: { select: { pack: { select: { id: true } } } },
          },
        })
      : [],
  ]);
  const legacyOwnedPokemon = ownedPokemon.filter(
    (owned) => owned.tierName === null || owned.tierColor === null,
  );
  const legacyEntries =
    legacyOwnedPokemon.length > 0
      ? await prisma.packEntry.findMany({
          where: {
            packId: {
              in: [
                ...new Set(
                  legacyOwnedPokemon.map((owned) => owned.purchase.pack.id),
                ),
              ],
            },
            speciesDex: {
              in: [...new Set(legacyOwnedPokemon.map((owned) => owned.speciesDex))],
            },
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
  const speciesByDex = new Map(species.map((entry) => [entry.dex, entry]));

  function getPlayer(participant: MatchParticipant | null) {
    if (!participant) {
      return null;
    }

    const roster = (participant.roster?.speciesIds ?? [])
      .map((dex) => {
        const entry = speciesByDex.get(dex);
        if (!entry) {
          return null;
        }

        const tierByKey = new Map<
          string,
          { name: string; color: string | null }
        >();
        for (const owned of ownedPokemon) {
          if (owned.participantId === participant.id && owned.speciesDex === dex) {
            const inferredTier = legacyTierByPackSpecies.get(
              `${owned.purchase.pack.id}:${dex}`,
            );
            const tierName = owned.tierName ?? inferredTier?.name;
            if (tierName) {
              const tierColor = owned.tierColor ?? inferredTier?.color ?? null;
              tierByKey.set(`${tierName}:${tierColor ?? ""}`, {
                name: tierName,
                color: tierColor,
              });
            }
          }
        }

        return { ...entry, tiers: [...tierByKey.values()] };
      })
      .filter((entry) => entry !== null);

    return {
      id: participant.id,
      isCurrentUser: participant.user.id === userId,
      group: participant.user.group,
      name:
        participant.user.name ??
        participant.user.username ??
        participant.user.email ??
        "Unnamed player",
      roster,
    };
  }

  const player1 = getPlayer(match.player1);
  const player2 = getPlayer(match.player2);

  return {
    id: match.id,
    roundNumber: match.roundNumber,
    status: match.status,
    winnerId: match.winnerId,
    winnerName:
      match.winnerId === player1?.id
        ? player1.name
        : match.winnerId === player2?.id
          ? player2.name
          : null,
    player1Vote: match.player1Vote,
    player2Vote: match.player2Vote,
    tournamentName: match.tournament.name,
    player1,
    player2,
  };
}

export async function canAccessMatch({
  tournamentId,
  matchId,
  userId,
  isAdmin,
}: {
  tournamentId: string;
  matchId: string;
  userId: string;
  isAdmin: boolean;
}) {
  if (isAdmin) {
    const match = await prisma.match.findFirst({
      where: { id: matchId, tournamentId },
      select: { id: true },
    });
    return match !== null;
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, tournamentId },
    select: { player1: { select: { userId: true } }, player2: { select: { userId: true } } },
  });
  return match?.player1?.userId === userId || match?.player2?.userId === userId;
}
