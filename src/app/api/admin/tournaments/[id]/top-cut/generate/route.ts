import { MatchStatus, ParticipantStatus, Prisma, TournamentStage } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSwissStandings } from "@/lib/tournament-standings";

class TopCutGenerationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to generate the playoff bracket." },
      { status: 401 },
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access is required." },
      { status: 403 },
    );
  }

  const { id: tournamentId } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lockedTournament = await tx.$queryRaw<
        Array<{
          id: string;
          format: string;
          currentStage: TournamentStage;
          completed: boolean;
          topCut: number;
          swissRounds: number;
        }>
      >`
        SELECT "id", "format", "currentStage", "completed", "topCut", "swissRounds"
        FROM "Tournament"
        WHERE "id" = ${tournamentId}
        FOR UPDATE
      `;
      const tournament = lockedTournament[0];
      if (!tournament) {
        throw new TopCutGenerationError("Tournament not found.", 404);
      }
      if (tournament.completed) {
        throw new TopCutGenerationError(
          "This tournament is already completed.",
          409,
        );
      }
      if (tournament.format !== "SWISS" || tournament.topCut === 0) {
        throw new TopCutGenerationError(
          "This tournament does not have a Swiss Top Cut configured.",
          409,
        );
      }
      if (tournament.topCut !== 4 && tournament.topCut !== 8) {
        throw new TopCutGenerationError(
          "Top Cut must be configured as 4 or 8 players.",
          409,
        );
      }
      if (
        tournament.currentStage !== TournamentStage.SWISS &&
        tournament.currentStage !== TournamentStage.SINGLE_ELIMINATION
      ) {
        throw new TopCutGenerationError(
          "A Top Cut bracket has already been generated.",
          409,
        );
      }

      const swissMatches = await tx.match.findMany({
        where: {
          tournamentId,
          OR: [{ stage: TournamentStage.SWISS }, { stage: null }],
        },
        orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
        select: {
          roundNumber: true,
          stage: true,
          player1Id: true,
          player2Id: true,
          winnerId: true,
          status: true,
        },
      });
      const swissRoundNumbers = [
        ...new Set(swissMatches.map((match) => match.roundNumber)),
      ];
      if (
        swissRoundNumbers.length !== tournament.swissRounds ||
        swissRoundNumbers.some(
          (roundNumber, index) => roundNumber !== index + 1,
        ) ||
        swissMatches.some(
          (match) =>
            match.status !== MatchStatus.COMPLETED ||
            !match.winnerId ||
            (match.winnerId !== match.player1Id &&
              match.winnerId !== match.player2Id),
        )
      ) {
        throw new TopCutGenerationError(
          "Complete all configured Swiss rounds before generating the Top Cut.",
          409,
        );
      }

      const participants = await tx.participant.findMany({
        where: {
          tournamentId,
          status: ParticipantStatus.APPROVED,
          checkedIn: true,
        },
        select: {
          id: true,
          user: { select: { name: true, username: true, email: true } },
        },
      });
      if (participants.length < tournament.topCut) {
        throw new TopCutGenerationError(
          `Top ${tournament.topCut} requires at least ${tournament.topCut} checked-in players; ${participants.length} are eligible.`,
          409,
        );
      }

      const standings = buildSwissStandings(participants, swissMatches);
      const seededIds = standings
        .slice(0, tournament.topCut)
        .map(({ id }) => id);
      const seedOrder =
        tournament.topCut === 4
          ? [0, 3, 1, 2]
          : [0, 7, 3, 4, 1, 6, 2, 5];
      const positionedIds = seedOrder.map((position) => seededIds[position]);
      const maxRound = await tx.match.aggregate({
        where: { tournamentId },
        _max: { roundNumber: true },
      });
      const roundNumber = (maxRound._max.roundNumber ?? 0) + 1;
      const matches: Prisma.MatchCreateManyInput[] = [];

      for (let index = 0; index < positionedIds.length; index += 2) {
        matches.push({
          tournamentId,
          roundNumber,
          stage: TournamentStage.TOP_CUT,
          bracketPosition: index / 2 + 1,
          player1Id: positionedIds[index],
          player2Id: positionedIds[index + 1],
          status: MatchStatus.PENDING,
        });
      }

      await tx.match.createMany({ data: matches });
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { currentStage: TournamentStage.TOP_CUT },
      });

      return {
        roundNumber,
        matchesCreated: matches.length,
        seededPlayers: positionedIds.length,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TopCutGenerationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
