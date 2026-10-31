import { MatchStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeTournamentIfComplete } from "@/lib/tournament-completion";
import { recordFriendlyMatchParticipation } from "@/lib/friendly-match";

type SubmissionResult =
  | {
      ok: true;
      status: MatchStatus;
      winnerId: string | null;
      player1Vote: string | null;
      player2Vote: string | null;
      player1DrawVote: boolean;
      player2DrawVote: boolean;
      isDraw: boolean;
      walletBalance: number;
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

  const outcome =
    typeof body === "object" && body !== null && "outcome" in body
      ? body.outcome
      : undefined;
  if (outcome !== "WIN" && outcome !== "LOSS" && outcome !== "DRAW") {
    return NextResponse.json(
      { error: "Choose whether you won, lost, or drew the match." },
      { status: 400 },
    );
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
      select: { completed: true, format: true },
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
          player1DrawVote: true,
          player2DrawVote: true,
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

    if (!match.player1Id || !match.player2Id) {
      return { ok: false, statusCode: 400, error: "This match has no opposing player." };
    }
    if (match.status !== MatchStatus.PENDING) {
      return {
        ok: false,
        statusCode: 409,
        error: "This match is no longer accepting result votes.",
      };
    }

    if (
      isPlayer1 &&
      (match.player1Vote !== null || match.player1DrawVote)
    ) {
      return { ok: false, statusCode: 409, error: "You have already submitted your vote." };
    }
    if (
      isPlayer2 &&
      (match.player2Vote !== null || match.player2DrawVote)
    ) {
      return { ok: false, statusCode: 409, error: "You have already submitted your vote." };
    }
    if (outcome === "DRAW" && tournament.format !== "FRIENDLY_MATCH") {
      return {
        ok: false,
        statusCode: 400,
        error: "Draw results are only available for Friendly Match wars.",
      };
    }

    const winnerId =
      outcome === "DRAW"
        ? null
        : outcome === "WIN"
        ? isPlayer1
          ? match.player1Id
          : match.player2Id
        : isPlayer1
          ? match.player2Id
          : match.player1Id;

    if (isPlayer1) {
      await tx.match.update({
        where: { id: matchId },
        data:
          outcome === "DRAW"
            ? { player1DrawVote: true }
            : { player1Vote: winnerId },
      });
    } else {
      await tx.match.update({
        where: { id: matchId },
        data:
          outcome === "DRAW"
            ? { player2DrawVote: true }
            : { player2Vote: winnerId },
      });
    }

    const votes = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      select: {
        player1Vote: true,
        player2Vote: true,
        player1DrawVote: true,
        player2DrawVote: true,
      },
    });
    const player1Voted = votes.player1Vote !== null || votes.player1DrawVote;
    const player2Voted = votes.player2Vote !== null || votes.player2DrawVote;
    const bothVoted = player1Voted && player2Voted;
    const votesAgree =
      votes.player1DrawVote === votes.player2DrawVote &&
      (votes.player1DrawVote || votes.player1Vote === votes.player2Vote);
    const status = !bothVoted
      ? MatchStatus.PENDING
      : votesAgree
        ? MatchStatus.COMPLETED
        : MatchStatus.DISPUTED;
    const isDraw = status === MatchStatus.COMPLETED && votes.player1DrawVote;
    const completedWinner =
      status === MatchStatus.COMPLETED && !isDraw ? votes.player1Vote : null;

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: {
        status,
        ...(status === MatchStatus.COMPLETED
          ? { winnerId: completedWinner, isDraw }
          : {}),
      },
      select: {
        status: true,
        winnerId: true,
        player1Vote: true,
        player2Vote: true,
        player1DrawVote: true,
        player2DrawVote: true,
        isDraw: true,
      },
    });

    if (status === MatchStatus.COMPLETED) {
      await recordFriendlyMatchParticipation(tx, tournamentId, matchId);
      await closeTournamentIfComplete(tx, tournamentId);
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { coinsBalance: true },
    });
    return {
      ok: true,
      ...updatedMatch,
      walletBalance: user.coinsBalance,
    };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
