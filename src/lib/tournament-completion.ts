import { MatchStatus, type Prisma } from "@prisma/client";

export async function closeTournamentIfComplete(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<boolean> {
  const lockedTournament = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Tournament"
    WHERE "id" = ${tournamentId}
    FOR UPDATE
  `;
  if (lockedTournament.length === 0) return false;

  const matches = await tx.match.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "desc" },
    select: {
      roundNumber: true,
      player1Id: true,
      player2Id: true,
      winnerId: true,
      status: true,
    },
  });
  if (matches.length === 0) return false;

  const finalRound = matches[0].roundNumber;
  const finalRoundMatches = matches.filter(
    (match) => match.roundNumber === finalRound,
  );
  const finalMatch = finalRoundMatches[0];
  const tournamentComplete =
    finalRoundMatches.length === 1 &&
    matches.every(
      (match) =>
        match.status === MatchStatus.COMPLETED &&
        match.winnerId !== null &&
        (match.winnerId === match.player1Id ||
          match.winnerId === match.player2Id),
    ) &&
    finalMatch.winnerId !== null;

  if (!tournamentComplete) return false;

  await tx.tournament.update({
    where: { id: tournamentId },
    data: { active: false, completed: true, checkInOpen: false },
  });

  return true;
}
