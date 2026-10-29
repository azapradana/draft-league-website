import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { MatchStatus } from "@prisma/client";
import DisputeResolutionPanel from "../matches/dispute-resolution-panel";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function playerName(
  participant: {
    user: { name: string | null; username: string | null; email: string | null };
  } | null,
) {
  if (!participant) return null;
  return participant.user.name ?? participant.user.username ?? participant.user.email ?? "Unnamed player";
}

export default async function AdminTournamentDisputesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      matches: {
        where: { status: MatchStatus.DISPUTED },
        orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
        include: {
          player1: { include: { user: { select: { name: true, username: true, email: true } } } },
          player2: { include: { user: { select: { name: true, username: true, email: true } } } },
        },
      },
    },
  });
  if (!tournament) notFound();

  const chats = tournament.matches.length
    ? await prisma.match.findMany({
        where: { id: { in: tournament.matches.map((match) => match.id) } },
        select: {
          id: true,
          messages: {
            orderBy: [{ timestamp: "desc" }, { id: "desc" }],
            take: 100,
            select: { id: true, senderName: true, content: true, timestamp: true },
          },
        },
      })
    : [];
  const messagesByMatch = new Map(
    chats.map((match) => [match.id, match.messages.reverse()]),
  );
  const disputeMatches = tournament.matches.map((match) => ({
    id: match.id,
    roundNumber: match.roundNumber,
    player1: match.player1
      ? { id: match.player1.id, name: playerName(match.player1) ?? "Unknown player" }
      : null,
    player2: match.player2
      ? { id: match.player2.id, name: playerName(match.player2) ?? "Unknown player" }
      : null,
    player1Vote: match.player1Vote,
    player2Vote: match.player2Vote,
    messages: (messagesByMatch.get(match.id) ?? []).map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
    })),
  }));

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            Disputes
          </p>
          <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            Review match reports, player votes, and chat history.
          </p>
        </header>
        {disputeMatches.length === 0 ? (
          <section className="rounded-2xl border border-[#243775] bg-[#0C1638] px-5 py-12 text-center">
            <h2 className="text-lg font-semibold">No open disputes</h2>
            <p className="mt-2 text-sm text-[#9FB0E6]">New disputed matches will appear here.</p>
          </section>
        ) : (
          <DisputeResolutionPanel tournamentId={tournament.id} matches={disputeMatches} />
        )}
      </div>
    </main>
  );
}
