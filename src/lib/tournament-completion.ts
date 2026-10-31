import {
  MatchStatus,
  TournamentStage,
  type Prisma,
} from "@prisma/client";
import { awardTournamentPrizes } from "@/lib/tournament-prizes";
import { recordFriendlyMatchParticipation } from "@/lib/friendly-match";

export async function closeTournamentIfComplete(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<boolean> {
  const lockedTournament = await tx.$queryRaw<
    Array<{
      id: string;
      format: string;
      currentStage: TournamentStage;
      topCut: number;
      swissRounds: number;
      completed: boolean;
    }>
  >`
    SELECT "id"
         , "format"
         , "currentStage"
         , "topCut"
         , "swissRounds"
         , "completed"
    FROM "Tournament"
    WHERE "id" = ${tournamentId}
    FOR UPDATE
  `;
  if (lockedTournament.length === 0) return false;
  const tournament = lockedTournament[0];
  if (tournament.completed) return false;

  const matches = await tx.match.findMany({
    where: { tournamentId },
    orderBy: { roundNumber: "desc" },
    select: {
      id: true,
      roundNumber: true,
      stage: true,
      player1Id: true,
      player2Id: true,
      winnerId: true,
      status: true,
      isDraw: true,
    },
  });
  if (matches.length === 0) return false;

  const getStage = (match: (typeof matches)[number]) =>
    match.stage ??
    (tournament.format === "SWISS" &&
    match.roundNumber <= tournament.swissRounds
      ? TournamentStage.SWISS
      : tournament.format === "FRIENDLY_MATCH"
        ? TournamentStage.FRIENDLY_MATCH
        : TournamentStage.SINGLE_ELIMINATION);
  const hasValidWinner = (match: (typeof matches)[number]) =>
    match.status === MatchStatus.COMPLETED &&
    match.winnerId !== null &&
    (match.winnerId === match.player1Id ||
      match.winnerId === match.player2Id);
  const hasValidOutcome = (match: (typeof matches)[number]) =>
    match.status === MatchStatus.COMPLETED &&
    (match.isDraw ? match.winnerId === null : hasValidWinner(match));

  if (tournament.format === "FRIENDLY_MATCH") {
    const friendlyMatches = matches.filter(
      (match) => getStage(match) === TournamentStage.FRIENDLY_MATCH,
    );
    if (
      friendlyMatches.length === 0 ||
      friendlyMatches.some(
        (match) =>
          match.status !== MatchStatus.COMPLETED || !hasValidOutcome(match),
      )
    ) {
      return false;
    }
    await Promise.all(
      friendlyMatches.map((match) =>
        recordFriendlyMatchParticipation(tx, tournamentId, match.id),
      ),
    );
  } else if (
    tournament.currentStage === TournamentStage.SWISS ||
    (tournament.format === "SWISS" &&
      tournament.currentStage === TournamentStage.SINGLE_ELIMINATION)
  ) {
    const swissMatches = matches.filter(
      (match) => getStage(match) === TournamentStage.SWISS,
    );
    const swissRounds = [...new Set(swissMatches.map((match) => match.roundNumber))];
    if (swissRounds.length < tournament.swissRounds) return false;

    const finalSwissRound = Math.max(...swissRounds);
    const finalSwissMatches = swissMatches.filter(
      (match) => match.roundNumber === finalSwissRound,
    );
    if (
      finalSwissMatches.length === 0 ||
      finalSwissMatches.some((match) => !hasValidWinner(match))
    ) {
      return false;
    }

    if (tournament.topCut > 0) return false;
  } else {
    const tournamentMatches = matches.filter(
      (match) =>
        getStage(match) === tournament.currentStage ||
        (tournament.currentStage === TournamentStage.SINGLE_ELIMINATION &&
          match.stage === null),
    );
    if (tournamentMatches.length === 0) return false;

    const finalRound = tournamentMatches[0].roundNumber;
    const finalRoundMatches = tournamentMatches.filter(
      (match) => match.roundNumber === finalRound,
    );
    if (
      finalRoundMatches.length !== 1 ||
      tournamentMatches.some((match) => !hasValidOutcome(match)) ||
      !hasValidOutcome(finalRoundMatches[0])
    ) {
      return false;
    }
  }

  await tx.tournament.update({
    where: { id: tournamentId },
    data: {
      active: false,
      completed: true,
      checkInOpen: false,
      currentStage: TournamentStage.COMPLETED,
    },
  });
  await awardTournamentPrizes(tx, tournamentId);

  return true;
}
