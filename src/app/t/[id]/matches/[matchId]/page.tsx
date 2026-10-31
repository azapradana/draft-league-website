import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchRoomData } from "@/lib/match-room";
import MatchRoom from "./match-room";

export default async function MatchRoomPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: tournamentId, matchId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/t/${tournamentId}/matches/${matchId}`,
      )}`,
    );
  }

  const match = await getMatchRoomData({
    tournamentId,
    matchId,
    userId: session.user.id,
    isAdmin: session.user.role === "ADMIN",
  });
  if (!match) {
    notFound();
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

  return (
    <MatchRoom
      tournamentId={tournamentId}
      match={match}
      initialMessages={recentMessages.reverse().map((message) => ({
        ...message,
        timestamp: message.timestamp.toISOString(),
      }))}
      isAdmin={session.user.role === "ADMIN"}
      currentUserId={session.user.id}
    />
  );
}
