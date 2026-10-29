import { randomInt } from "node:crypto";
import { MatchStatus, ParticipantStatus, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
): Prisma.MatchCreateManyInput[] {
  const shuffledIds = shuffle([...participantIds]);
  const matches: Prisma.MatchCreateManyInput[] = [];

  for (let index = 0; index < shuffledIds.length; index += 2) {
    const player1Id = shuffledIds[index];
    const player2Id = shuffledIds[index + 1] ?? null;
    const isBye = player2Id === null;

    matches.push({
      tournamentId,
      roundNumber,
      player1Id,
      player2Id,
      winnerId: isBye ? player1Id : null,
      status: isBye ? MatchStatus.COMPLETED : MatchStatus.PENDING,
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
        Array<{ id: string; checkInOpen: boolean }>
      >`
        SELECT "id", "checkInOpen"
        FROM "Tournament"
        WHERE "id" = ${tournamentId}
        FOR UPDATE
      `;

      if (tournament.length === 0) {
        throw new RoundGenerationError("Tournament not found.", 404);
      }

      const latestMatch = await tx.match.findFirst({
        where: { tournamentId },
        orderBy: { roundNumber: "desc" },
        select: { roundNumber: true },
      });

      let roundNumber: number;
      let participantIds: string[];

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

        roundNumber = 1;
        participantIds = participants.map(({ id }) => id);
      } else {
        roundNumber = latestMatch.roundNumber + 1;
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
          previousMatches.some((match) => match.status !== MatchStatus.COMPLETED)
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

      const matches = createMatchInputs(
        tournamentId,
        roundNumber,
        participantIds,
      );
      await tx.match.createMany({ data: matches });

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
