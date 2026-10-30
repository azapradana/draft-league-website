"use server";

import { MatchStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeTournamentIfComplete } from "@/lib/tournament-completion";

type OverrideResult =
  | { success: true }
  | { error: string };

function parseScore(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    return null;
  }
  const score = Number(value);
  return Number.isSafeInteger(score) && score <= 2_147_483_647 ? score : null;
}

export async function declareMatchWinner(
  formData: FormData,
): Promise<OverrideResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Sign in to override a match." };
  }
  if (session.user.role !== "ADMIN") {
    return { error: "Admin access is required." };
  }

  const tournamentId = formData.get("tournamentId");
  const matchId = formData.get("matchId");
  const winnerId = formData.get("winnerId");
  const player1Score = parseScore(formData.get("player1Score"));
  const player2Score = parseScore(formData.get("player2Score"));
  if (
    typeof tournamentId !== "string" ||
    !tournamentId ||
    typeof matchId !== "string" ||
    !matchId ||
    typeof winnerId !== "string" ||
    !winnerId
  ) {
    return { error: "Choose a tournament, match, and winner." };
  }
  if (player1Score === null || player2Score === null) {
    return { error: "Enter a non-negative whole-number score for each player." };
  }
  if (player1Score === player2Score) {
    return { error: "The final scores must not be tied." };
  }

  const result = await prisma.$transaction(async (tx): Promise<OverrideResult> => {
    const lockedMatch = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Match"
      WHERE "id" = ${matchId} AND "tournamentId" = ${tournamentId}
      FOR UPDATE
    `;
    if (lockedMatch.length === 0) {
      return { error: "Match not found." };
    }

    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { completed: true },
    });
    if (!tournament) {
      return { error: "Tournament not found." };
    }
    if (tournament.completed) {
      return { error: "Completed tournaments no longer accept match overrides." };
    }

    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        roundNumber: true,
        player1Id: true,
        player2Id: true,
      },
    });
    if (!match) {
      return { error: "Match not found." };
    }
    if (!match.player1Id || !match.player2Id) {
      return { error: "Only matches with two players can receive a score override." };
    }
    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      return { error: "Choose one of this match's players as winner." };
    }
    if (
      (winnerId === match.player1Id && player1Score <= player2Score) ||
      (winnerId === match.player2Id && player2Score <= player1Score)
    ) {
      return { error: "The selected winner must have the higher score." };
    }

    const laterMatch = await tx.match.findFirst({
      where: { tournamentId, roundNumber: { gt: match.roundNumber } },
      select: { id: true },
    });
    if (laterMatch) {
      return {
        error: "This match has already fed into a later round and can no longer be changed.",
      };
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        winnerId,
        status: MatchStatus.COMPLETED,
        player1Score,
        player2Score,
        adminOverrideById: session.user.id,
        adminOverrideAt: new Date(),
      },
    });
    await closeTournamentIfComplete(tx, tournamentId);
    return { success: true };
  });

  if ("success" in result) {
    revalidatePath(`/admin/t/${tournamentId}/matches`);
    revalidatePath(`/t/${tournamentId}/standings`);
    revalidatePath(`/t/${tournamentId}`);
  }
  return result;
}
