import {
  MatchStatus,
  ParticipantStatus,
  TournamentFormat,
  TournamentStage,
  type Prisma,
} from "@prisma/client";
import { buildSwissStandings } from "@/lib/tournament-standings";
import { parsePrizeDistribution } from "@/lib/prize-distribution";

type RankedParticipant = {
  id: string;
  userId: string;
  user: {
    name: string | null;
    username: string | null;
    email: string | null;
  };
};

async function getPrizeRankings(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<RankedParticipant[]> {
  const tournament = await tx.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: {
      format: true,
      swissRounds: true,
      friendlyMatchGroupId: true,
    },
  });
  const participants = await tx.participant.findMany({
    where: {
      tournamentId,
      status: ParticipantStatus.APPROVED,
      ...(tournament.format === TournamentFormat.FRIENDLY_MATCH
        ? {}
        : { checkedIn: true }),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      userId: true,
      friendlyMatchGroupId: true,
      user: { select: { name: true, username: true, email: true } },
    },
  });
  const matches = await tx.match.findMany({
    where: { tournamentId },
    select: {
      roundNumber: true,
      stage: true,
      bracketPosition: true,
      player1Id: true,
      player2Id: true,
      winnerId: true,
      status: true,
      isDraw: true,
    },
  });

  if (tournament.format === TournamentFormat.FRIENDLY_MATCH) {
    const coreGroup = await tx.group.findFirst({
      where: { isCore: true },
      select: { id: true },
    });
    const participantsById = new Map(
      participants.map((participant) => [participant.id, participant]),
    );
    const groupWins = new Map<string, number>();
    const individualResults = new Map<string, number>();
    for (const match of matches) {
      if (match.status !== MatchStatus.COMPLETED) continue;
      const player1 = match.player1Id
        ? participantsById.get(match.player1Id)
        : undefined;
      const player2 = match.player2Id
        ? participantsById.get(match.player2Id)
        : undefined;
      if (
        !player1 ||
        !player2 ||
        (match.winnerId !== player1.id && match.winnerId !== player2.id)
      ) {
        if (match.isDraw && player1 && player2) {
          individualResults.set(player1.id, 1);
          individualResults.set(player2.id, 1);
        }
        continue;
      }
      if (match.isDraw) {
        individualResults.set(player1.id, 1);
        individualResults.set(player2.id, 1);
        continue;
      }

      const winner = match.winnerId === player1.id ? player1 : player2;
      const loser = winner.id === player1.id ? player2 : player1;
      individualResults.set(winner.id, 0);
      individualResults.set(loser.id, 2);
      const winnerGroupId = winner.friendlyMatchGroupId;
      if (winnerGroupId) {
        groupWins.set(winnerGroupId, (groupWins.get(winnerGroupId) ?? 0) + 1);
      }
    }

    const coreWins = coreGroup ? (groupWins.get(coreGroup.id) ?? 0) : 0;
    const rivalWins = tournament.friendlyMatchGroupId
      ? (groupWins.get(tournament.friendlyMatchGroupId) ?? 0)
      : 0;
    const winningGroupId =
      coreWins === rivalWins
        ? null
        : coreWins > rivalWins
          ? coreGroup?.id ?? null
          : tournament.friendlyMatchGroupId;

    return participants
      .filter((participant) => individualResults.has(participant.id))
      .sort((left, right) => {
        const groupRank =
          winningGroupId === null
            ? 0
            : Number(left.friendlyMatchGroupId !== winningGroupId) -
              Number(right.friendlyMatchGroupId !== winningGroupId);
        if (groupRank !== 0) return groupRank;
        const resultRank =
          (individualResults.get(left.id) ?? 3) -
          (individualResults.get(right.id) ?? 3);
        if (resultRank !== 0) return resultRank;
        const leftName = left.user.name ?? left.user.username ?? "";
        const rightName = right.user.name ?? right.user.username ?? "";
        return leftName.localeCompare(rightName) || left.id.localeCompare(right.id);
      });
  }

  const swissMatches = matches.filter(
    (match) =>
      match.stage === TournamentStage.SWISS ||
      (tournament.format === TournamentFormat.SWISS &&
        match.stage === null &&
        match.roundNumber <= tournament.swissRounds),
  );
  const swissRankings = buildSwissStandings(participants, swissMatches);
  const rankedIds: string[] = [];
  const participantIds = new Set(participants.map((participant) => participant.id));
  const addRankedId = (participantId: string | null) => {
    if (
      participantId &&
      participantIds.has(participantId) &&
      !rankedIds.includes(participantId)
    ) {
      rankedIds.push(participantId);
    }
  };

  const playoffMatches = matches.filter(
    (match) =>
      match.status === MatchStatus.COMPLETED &&
      match.winnerId !== null &&
      (match.stage === TournamentStage.TOP_CUT ||
        (tournament.format === TournamentFormat.SINGLE_ELIMINATION &&
          (match.stage === TournamentStage.SINGLE_ELIMINATION ||
            match.stage === null))),
  );
  if (playoffMatches.length > 0) {
    const finalRound = Math.max(...playoffMatches.map((match) => match.roundNumber));
    const finalMatches = playoffMatches
      .filter((match) => match.roundNumber === finalRound)
      .sort(
        (a, b) =>
          (a.bracketPosition ?? Number.MAX_SAFE_INTEGER) -
            (b.bracketPosition ?? Number.MAX_SAFE_INTEGER) ||
          (a.player1Id ?? "").localeCompare(b.player1Id ?? ""),
      );
    if (finalMatches.length === 1) addRankedId(finalMatches[0].winnerId);

    const eliminationRounds = [
      ...new Set(playoffMatches.map((match) => match.roundNumber)),
    ].sort((a, b) => b - a);
    for (const roundNumber of eliminationRounds) {
      const roundMatches = playoffMatches
        .filter((match) => match.roundNumber === roundNumber)
        .sort(
          (a, b) =>
            (a.bracketPosition ?? Number.MAX_SAFE_INTEGER) -
              (b.bracketPosition ?? Number.MAX_SAFE_INTEGER) ||
            (a.player1Id ?? "").localeCompare(b.player1Id ?? ""),
        );
      for (const match of roundMatches) {
        addRankedId(match.player1Id === match.winnerId ? match.player2Id : match.player1Id);
      }
    }
  }

  for (const participant of swissRankings) addRankedId(participant.id);
  for (const participant of participants) addRankedId(participant.id);

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  return rankedIds.flatMap((id) => {
    const participant = participantsById.get(id);
    return participant ? [participant] : [];
  });
}

export async function awardTournamentPrizes(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<void> {
  const priorPayouts = await tx.tournamentPrizePayout.count({
    where: { tournamentId },
  });
  if (priorPayouts > 0) return;

  const tournament = await tx.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: {
      coinPrizePool: true,
      prizeWinnersCount: true,
      prizeDistribution: true,
    },
  });
  if (tournament.coinPrizePool === 0 || tournament.prizeWinnersCount === 0) return;

  const distribution = parsePrizeDistribution(tournament.prizeDistribution);
  if (
    !distribution ||
    distribution.length !== tournament.prizeWinnersCount ||
    distribution.reduce((sum, amount) => sum + amount, 0) !==
      tournament.coinPrizePool
  ) {
    throw new Error(
      `Tournament ${tournamentId} has an invalid coin prize distribution.`,
    );
  }

  const rankings = await getPrizeRankings(tx, tournamentId);
  const winners = rankings.slice(0, tournament.prizeWinnersCount);
  for (const [index, winner] of winners.entries()) {
    const amount = distribution[index];
    if (!amount) continue;

    const currentUser = await tx.user.findUniqueOrThrow({
      where: { id: winner.userId },
      select: { coinsBalance: true },
    });
    if (currentUser.coinsBalance > 2_147_483_647 - amount) {
      throw new Error(
        `Tournament ${tournamentId} prize would exceed a winner's maximum wallet balance.`,
      );
    }

    await tx.user.update({
      where: { id: winner.userId },
      data: { coinsBalance: { increment: amount } },
    });
    await tx.tournamentPrizePayout.create({
      data: {
        tournamentId,
        participantId: winner.id,
        userId: winner.userId,
        place: index + 1,
        amount,
      },
    });
  }
}
