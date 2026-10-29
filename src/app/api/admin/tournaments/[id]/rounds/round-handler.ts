import { randomInt } from "node:crypto";
import {
  MatchStatus,
  ParticipantStatus,
  Prisma,
  TournamentStage,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeTournamentIfComplete } from "@/lib/tournament-completion";
import { buildSwissStandings } from "@/lib/tournament-standings";

class RoundGenerationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function createMatchInputs(
  tournamentId: string,
  roundNumber: number,
  participantIds: string[],
  stage: TournamentStage,
  randomize = true,
): Prisma.MatchCreateManyInput[] {
  const shuffledIds = randomize
    ? shuffle([...participantIds])
    : [...participantIds];
  const matches: Prisma.MatchCreateManyInput[] = [];

  for (let index = 0; index < shuffledIds.length; index += 2) {
    const player1Id = shuffledIds[index];
    const player2Id = shuffledIds[index + 1] ?? null;
    const isBye = player2Id === null;

    matches.push({
      tournamentId,
      roundNumber,
      stage,
      bracketPosition:
        stage === TournamentStage.TOP_CUT ? matches.length + 1 : null,
      player1Id,
      player2Id,
      winnerId: isBye ? player1Id : null,
      status: isBye ? MatchStatus.COMPLETED : MatchStatus.PENDING,
    });
  }

  return matches;
}

function createSwissMatchInputs(
  tournamentId: string,
  roundNumber: number,
  orderedParticipantIds: string[],
  previousMatches: Array<{
    player1Id: string | null;
    player2Id: string | null;
  }>,
): Prisma.MatchCreateManyInput[] {
  const alreadyPaired = new Set(
    previousMatches
      .filter((match) => match.player1Id && match.player2Id)
      .map((match) =>
        [match.player1Id!, match.player2Id!].sort().join(":"),
      ),
  );
  const hadBye = new Set(
    previousMatches
      .filter((match) => match.player1Id && match.player2Id === null)
      .map((match) => match.player1Id!),
  );
  const participants = [...orderedParticipantIds];
  const matches: Prisma.MatchCreateManyInput[] = [];

  if (participants.length % 2 === 1) {
    let byeIndex = -1;
    for (let index = participants.length - 1; index >= 0; index -= 1) {
      if (!hadBye.has(participants[index])) {
        byeIndex = index;
        break;
      }
    }
    if (byeIndex === -1) byeIndex = participants.length - 1;
    const [byePlayer] = participants.splice(byeIndex, 1);
    matches.push({
      tournamentId,
      roundNumber,
      stage: TournamentStage.SWISS,
      player1Id: byePlayer,
      player2Id: null,
      winnerId: byePlayer,
      status: MatchStatus.COMPLETED,
    });
  }

  while (participants.length > 0) {
    const player1Id = participants.shift()!;
    let opponentIndex = participants.findIndex(
      (candidate) =>
        !alreadyPaired.has([player1Id, candidate].sort().join(":")),
    );
    if (opponentIndex === -1) opponentIndex = 0;
    const [player2Id] = participants.splice(opponentIndex, 1);
    matches.push({
      tournamentId,
      roundNumber,
      stage: TournamentStage.SWISS,
      player1Id,
      player2Id,
      winnerId: null,
      status: MatchStatus.PENDING,
    });
  }

  return matches;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false as const, status: 401, error: "Sign in to continue." };
  }

  if (session.user.role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Admin access is required." };
  }

  return { ok: true as const };
}

export async function generateRound(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id: tournamentId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tournament = await tx.$queryRaw<
        Array<{
          id: string;
          checkInOpen: boolean;
          completed: boolean;
          format: string;
          swissRounds: number;
          topCut: number;
          currentStage: TournamentStage;
        }>
      >`
        SELECT "id", "checkInOpen", "completed", "format", "swissRounds", "topCut", "currentStage"
        FROM "Tournament"
        WHERE "id" = ${tournamentId}
        FOR UPDATE
      `;

      if (tournament.length === 0) {
        throw new RoundGenerationError("Tournament not found.", 404);
      }
      if (tournament[0].completed) {
        throw new RoundGenerationError(
          "This tournament is completed and cannot start another round.",
          409,
        );
      }

      const currentStage =
        tournament[0].format === "SWISS" &&
        tournament[0].currentStage === TournamentStage.SINGLE_ELIMINATION
          ? TournamentStage.SWISS
          : tournament[0].currentStage;
      if (currentStage !== tournament[0].currentStage) {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { currentStage },
        });
      }

      let roundNumber: number;
      let participantIds: string[];
      const maxRound = await tx.match.aggregate({
        where: { tournamentId },
        _max: { roundNumber: true },
      });
      roundNumber = (maxRound._max.roundNumber ?? 0) + 1;
      let matches: Prisma.MatchCreateManyInput[];

      if (currentStage === TournamentStage.SWISS) {
        const swissMatches = await tx.match.findMany({
          where: {
            tournamentId,
            OR: [{ stage: TournamentStage.SWISS }, { stage: null }],
          },
          orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
          select: {
            roundNumber: true,
            stage: true,
            status: true,
            player1Id: true,
            player2Id: true,
            winnerId: true,
          },
        });
        const swissRoundNumbers = [
          ...new Set(swissMatches.map((match) => match.roundNumber)),
        ];
        const lastSwissRound =
          swissRoundNumbers[swissRoundNumbers.length - 1];
        const previousMatches =
          lastSwissRound === undefined
            ? []
            : swissMatches.filter(
                (match) => match.roundNumber === lastSwissRound,
              );

        if (lastSwissRound !== undefined) {
          if (
            previousMatches.length === 0 ||
            previousMatches.some(
              (match) =>
                match.status !== MatchStatus.COMPLETED ||
                !match.winnerId ||
                (match.winnerId !== match.player1Id &&
                  match.winnerId !== match.player2Id),
            )
          ) {
            throw new RoundGenerationError(
              "Complete every match in the current Swiss round before generating the next round.",
              409,
            );
          }
          if (swissRoundNumbers.length >= tournament[0].swissRounds) {
            throw new RoundGenerationError(
              "The Swiss stage is complete. Generate the configured Top Cut bracket or finalize the tournament.",
              409,
            );
          }
        } else if (tournament[0].checkInOpen) {
          throw new RoundGenerationError(
            "Close check-in before generating Round 1.",
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
        if (participants.length < 2) {
          throw new RoundGenerationError(
            "At least two approved participants must be checked in to start Swiss rounds.",
            409,
          );
        }

        roundNumber =
          lastSwissRound === undefined ? 1 : roundNumber;
        const standings = buildSwissStandings(participants, swissMatches);
        const orderedIds = standings.map(({ id }) => id);
        if (lastSwissRound === undefined) shuffle(orderedIds);
        participantIds = orderedIds;
        matches = createSwissMatchInputs(
          tournamentId,
          roundNumber,
          participantIds,
          swissMatches,
        );
      } else if (currentStage === TournamentStage.TOP_CUT) {
        const previousMatches = await tx.match.findMany({
          where: { tournamentId, stage: TournamentStage.TOP_CUT },
          orderBy: [
            { roundNumber: "desc" },
            { bracketPosition: "asc" },
          ],
          select: {
            roundNumber: true,
            status: true,
            player1Id: true,
            player2Id: true,
            winnerId: true,
          },
        });
        const latestRound = previousMatches[0]?.roundNumber;
        const latestRoundMatches = previousMatches.filter(
          (match) => match.roundNumber === latestRound,
        );
        if (
          latestRoundMatches.length === 0 ||
          latestRoundMatches.some(
            (match) =>
              match.status !== MatchStatus.COMPLETED ||
              !match.winnerId ||
              (match.winnerId !== match.player1Id &&
                match.winnerId !== match.player2Id),
          )
        ) {
          throw new RoundGenerationError(
            "Complete every playoff match before generating the next round.",
            409,
          );
        }
        participantIds = latestRoundMatches.map((match) => match.winnerId!);
        if (participantIds.length < 2) {
          throw new RoundGenerationError(
            "The tournament is complete; there is no next playoff round.",
            409,
          );
        }
        matches = createMatchInputs(
          tournamentId,
          roundNumber,
          participantIds,
          TournamentStage.TOP_CUT,
          false,
        );
      } else if (
        currentStage === TournamentStage.SINGLE_ELIMINATION
      ) {
        const latestMatch = await tx.match.findFirst({
          where: { tournamentId },
          orderBy: { roundNumber: "desc" },
          select: { roundNumber: true },
        });

        if (!latestMatch) {
          if (tournament[0].checkInOpen) {
            throw new RoundGenerationError(
              "Close check-in before generating Round 1.",
              409,
            );
          }
          const participants = await tx.participant.findMany({
            where: {
              tournamentId,
              status: ParticipantStatus.APPROVED,
              checkedIn: true,
            },
            select: { id: true },
          });
          if (participants.length === 0) {
            throw new RoundGenerationError(
              "No approved participants have checked in.",
              409,
            );
          }
          participantIds = participants.map(({ id }) => id);
        } else {
          const previousMatches = await tx.match.findMany({
            where: {
              tournamentId,
              roundNumber: latestMatch.roundNumber,
            },
            select: {
              status: true,
              player1Id: true,
              player2Id: true,
              winnerId: true,
            },
          });
          if (
            previousMatches.length === 0 ||
            previousMatches.some(
              (match) => match.status !== MatchStatus.COMPLETED,
            )
          ) {
            throw new RoundGenerationError(
              "Complete every match in the current round before generating the next round.",
              409,
            );
          }
          if (
            previousMatches.some(
              (match) =>
                !match.winnerId ||
                (match.winnerId !== match.player1Id &&
                  match.winnerId !== match.player2Id),
            )
          ) {
            throw new RoundGenerationError(
              "Every completed match must have a valid winner before advancing.",
              409,
            );
          }
          participantIds = previousMatches.map((match) => match.winnerId!);
          if (new Set(participantIds).size !== participantIds.length) {
            throw new RoundGenerationError(
              "A participant cannot advance from more than one match in the same round.",
              409,
            );
          }
          if (participantIds.length < 2) {
            throw new RoundGenerationError(
              "The tournament is complete; there is no next round to generate.",
              409,
            );
          }
        }
        matches = createMatchInputs(
          tournamentId,
          roundNumber,
          participantIds,
          TournamentStage.SINGLE_ELIMINATION,
        );
      } else {
        throw new RoundGenerationError(
          "This tournament stage does not accept additional rounds.",
          409,
        );
      }

      await tx.match.createMany({ data: matches });
      await closeTournamentIfComplete(tx, tournamentId);

      return {
        roundNumber,
        matchesCreated: matches.length,
        byes: matches.filter((match) => match.player2Id === null).length,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RoundGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
