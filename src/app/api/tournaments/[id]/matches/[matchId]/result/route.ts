import { MatchStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeTournamentIfComplete } from "@/lib/tournament-completion";

type SubmissionResult =
  | {
      ok: true;
      status: MatchStatus;
      winnerId: string | null;
      player1Vote: string | null;
      player2Vote: string | null;
    }
  | { ok: false; statusCode: number; error: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to submit a match result." }, { status: 401 });
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

  const result = await prisma.$transaction(async (tx): Promise<SubmissionResult> => {
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
        error: "This tournament is completed and no longer accepts match results.",
      };
    }

    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        status: true,
        player1Id: true,
        player2Id: true,
        player1Vote: true,
        player2Vote: true,
        player1: { select: { userId: true } },
        player2: { select: { userId: true } },
      },
    });
    if (!match) {
      return { ok: false, statusCode: 404, error: "Match not found." };
    }

    const isPlayer1 = match.player1?.userId === session.user.id;
    const isPlayer2 = match.player2?.userId === session.user.id;
    if (!isPlayer1 && !isPlayer2) {
      return { ok: false, statusCode: 403, error: "Only players in this match can vote." };
    }

    if (
      !match.player1Id ||
      !match.player2Id ||
      (winnerId !== match.player1Id && winnerId !== match.player2Id)
    ) {
      return { ok: false, statusCode: 400, error: "Choose one of this match's players as winner." };
    }
    if (match.status !== MatchStatus.PENDING) {
      return {
        ok: false,
        statusCode: 409,
        error: "This match is no longer accepting result votes.",
      };
    }

    if (isPlayer1 && match.player1Vote !== null) {
      return { ok: false, statusCode: 409, error: "You have already submitted your vote." };
    }
    if (isPlayer2 && match.player2Vote !== null) {
      return { ok: false, statusCode: 409, error: "You have already submitted your vote." };
    }

    if (isPlayer1) {
      await tx.match.update({
        where: { id: matchId },
        data: { player1Vote: winnerId },
      });
    } else {
      await tx.match.update({
        where: { id: matchId },
        data: { player2Vote: winnerId },
      });
    }

    const votes = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      select: { player1Vote: true, player2Vote: true },
    });
    const bothVoted = votes.player1Vote !== null && votes.player2Vote !== null;
    const status = !bothVoted
      ? MatchStatus.PENDING
      : votes.player1Vote === votes.player2Vote
        ? MatchStatus.COMPLETED
        : MatchStatus.DISPUTED;
    const completedWinner = status === MatchStatus.COMPLETED ? votes.player1Vote : null;

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: {
        status,
        ...(status === MatchStatus.COMPLETED ? { winnerId: completedWinner } : {}),
      },
      select: {
        status: true,
        winnerId: true,
        player1Vote: true,
        player2Vote: true,
      },
    });

    if (status === MatchStatus.COMPLETED) {
      await closeTournamentIfComplete(tx, tournamentId);
    }

    return { ok: true, ...updatedMatch };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
