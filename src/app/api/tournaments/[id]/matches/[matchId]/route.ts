import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchRoomData } from "@/lib/match-room";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to view this match." }, { status: 401 });
  }

  const { id: tournamentId, matchId } = await params;
  const match = await getMatchRoomData({
    tournamentId,
    matchId,
    userId: session.user.id,
    isAdmin: session.user.role === "ADMIN",
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const recentMessages = await prisma.matchMessage.findMany({
    where: { matchId },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      senderId: true,
      senderName: true,
      content: true,
      timestamp: true,
    },
  });

  return NextResponse.json(
    { match, messages: recentMessages.reverse() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
