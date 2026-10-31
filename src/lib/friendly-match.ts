import { MatchStatus, TournamentFormat, type Prisma } from "@prisma/client";

export async function recordFriendlyMatchParticipation(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  matchId: string,
) {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (tournament?.format !== TournamentFormat.FRIENDLY_MATCH) return;

  const match = await tx.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      friendlyMatchParticipationCounted: true,
      player1: { select: { userId: true } },
      player2: { select: { userId: true } },
    },
  });
  if (
    !match ||
    match.status !== MatchStatus.COMPLETED ||
    match.friendlyMatchParticipationCounted
  ) {
    return;
  }

  const marked = await tx.match.updateMany({
    where: {
      id: matchId,
      status: MatchStatus.COMPLETED,
      friendlyMatchParticipationCounted: false,
    },
    data: { friendlyMatchParticipationCounted: true },
  });
  if (marked.count === 0) return;

  const userIds = [
    ...new Set(
      [match.player1?.userId, match.player2?.userId].filter(
        (userId): userId is string => userId !== undefined,
      ),
    ),
  ];
  if (userIds.length > 0) {
    await tx.user.updateMany({
      where: { id: { in: userIds } },
      data: { friendlyMatchParticipationCount: { increment: 1 } },
    });
  }
}
