import { MatchStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeTournamentIfComplete } from "@/lib/tournament-completion";

type ResolutionResult =
  | { ok: true; winnerId: string }
  | { ok: false; statusCode: number; error: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to resolve a match." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const { id: tournamentId, matchId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const winnerId =
    typeof body === "object" && body !== null && "winnerId" in body
      ? body.winnerId
      : undefined;
  if (typeof winnerId !== "string" || winnerId.length === 0) {
    return NextResponse.json({ error: "Choose the match winner." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx): Promise<ResolutionResult> => {
    const lockedMatch = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Match"
      WHERE "id" = ${matchId} AND "tournamentId" = ${tournamentId}
      FOR UPDATE
    `;
    if (lockedMatch.length === 0) {
      return { ok: false, statusCode: 404, error: "Match not found." };
    }

    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { completed: true },
    });
    if (!tournament) {
      return { ok: false, statusCode: 404, error: "Tournament not found." };
    }
    if (tournament.completed) {
      return {
        ok: false,
        statusCode: 409,
        error: "This tournament is completed and no longer accepts match resolutions.",
      };
    }

    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: { status: true, player1Id: true, player2Id: true },
    });
    if (!match) {
      return { ok: false, statusCode: 404, error: "Match not found." };
    }
    if (match.status !== MatchStatus.DISPUTED) {
      return {
        ok: false,
        statusCode: 409,
        error: "Only disputed matches can be resolved here.",
      };
    }
    if (
      !match.player1Id ||
      !match.player2Id ||
      (winnerId !== match.player1Id && winnerId !== match.player2Id)
    ) {
      return { ok: false, statusCode: 400, error: "Choose one of this match's players as winner." };
    }

    await tx.match.update({
      where: { id: matchId },
      data: { winnerId, status: MatchStatus.COMPLETED },
    });
    await closeTournamentIfComplete(tx, tournamentId);
    return { ok: true, winnerId };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }

  return NextResponse.json(
    { winnerId: result.winnerId, status: MatchStatus.COMPLETED },
    { headers: { "Cache-Control": "no-store" } },
  );
}
