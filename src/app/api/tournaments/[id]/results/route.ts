import { NextResponse } from "next/server";
import { authFailure, requireUser } from "@/lib/api-auth";
import { rankDoubleElimination } from "@/lib/double-elimination-standings";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireUser(id);
  if (!auth.ok) return authFailure(auth);
  if (auth.session.user.role === "GUEST") {
    return NextResponse.json({ error: "Guests cannot access this bracket." }, { status: 403 });
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { format: true, mode: true, completed: true },
  });
  if (!tournament || tournament.format !== "DOUBLE_ELIMINATION" || tournament.mode !== "REGULAR") {
    return NextResponse.json({ error: "Tournament results not found." }, { status: 404 });
  }
  if (!auth.isAdmin) {
    const participant = await prisma.participant.findUnique({
      where: { userId_tournamentId: { userId: auth.userId, tournamentId: id } },
      select: { status: true },
    });
    if (participant?.status !== "APPROVED") {
      return NextResponse.json({ error: "Only approved participants can view this bracket." }, { status: 403 });
    }
  }
  const [matches, participants] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: id, bracket: { not: null } },
      orderBy: [{ bracket: "asc" }, { roundNumber: "asc" }, { bracketPosition: "asc" }],
      select: {
        id: true,
        bracket: true,
        roundNumber: true,
        bracketPosition: true,
        nextWinMatchId: true,
        nextWinSlot: true,
        nextLoseMatchId: true,
        nextLoseSlot: true,
        status: true,
        winnerId: true,
        player1Id: true,
        player2Id: true,
        player1: { select: { id: true, user: { select: { name: true, username: true } } } },
        player2: { select: { id: true, user: { select: { name: true, username: true } } } },
      },
    }),
    prisma.participant.findMany({
      where: { tournamentId: id, status: "APPROVED" },
      select: { id: true, bracketSeed: true, droppedAt: true, user: { select: { name: true, username: true } } },
    }),
  ]);
  return NextResponse.json({
    matches,
    placements: tournament.completed
      ? rankDoubleElimination(participants, matches).map((participant, index) => ({
          ...participant,
          place: index + 1,
          dropped: participant.droppedAt !== null,
        }))
      : [],
  }, { headers: { "Cache-Control": "no-store" } });
}
