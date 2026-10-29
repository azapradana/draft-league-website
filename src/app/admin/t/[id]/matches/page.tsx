import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ParticipantStatus } from "@prisma/client";
import RoundControls from "./round-controls";
import DisputeResolutionPanel from "./dispute-resolution-panel";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function playerName(
  participant: {
    user: { name: string | null; username: string | null; email: string | null };
  } | null,
) {
  if (!participant) {
    return "Bye";
  }

  return (
    participant.user.name ??
    participant.user.username ??
    participant.user.email ??
    "Unnamed player"
  );
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-950 text-emerald-300";
    case "DISPUTED":
      return "bg-red-950 text-red-300";
    default:
      return "bg-[#243775] text-[#9FB0E6]";
  }
}

export default async function AdminTournamentMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      checkInOpen: true,
      participants: {
        where: {
          status: ParticipantStatus.APPROVED,
          checkedIn: true,
        },
        select: { id: true },
      },
      matches: {
        orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
        include: {
          player1: {
            include: {
              user: { select: { name: true, username: true, email: true } },
            },
          },
          player2: {
            include: {
              user: { select: { name: true, username: true, email: true } },
            },
          },
          winner: {
            include: {
              user: { select: { name: true, username: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    notFound();
  }

  const disputedMatches = tournament.matches.filter(
    (match) => match.status === "DISPUTED",
  );
  const disputeChats =
    disputedMatches.length > 0
      ? await prisma.match.findMany({
          where: { id: { in: disputedMatches.map((match) => match.id) } },
          select: {
            id: true,
            messages: {
              orderBy: [{ timestamp: "desc" }, { id: "desc" }],
              take: 100,
              select: {
                id: true,
                senderName: true,
                content: true,
                timestamp: true,
              },
            },
          },
        })
      : [];
  const messagesByMatch = new Map(
    disputeChats.map((match) => [
      match.id,
      match.messages.reverse(),
    ]),
  );
  const disputePanelMatches = disputedMatches.map((match) => ({
    id: match.id,
    roundNumber: match.roundNumber,
    player1: match.player1
      ? { id: match.player1.id, name: playerName(match.player1) }
      : null,
    player2: match.player2
      ? { id: match.player2.id, name: playerName(match.player2) }
      : null,
    player1Vote: match.player1Vote,
    player2Vote: match.player2Vote,
    messages: (messagesByMatch.get(match.id) ?? []).map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString(),
    })),
  }));

  const currentRound =
    tournament.matches.length > 0
      ? tournament.matches[tournament.matches.length - 1].roundNumber
      : null;
  const currentRoundMatches = tournament.matches.filter(
    (match) => match.roundNumber === currentRound,
  );
  const currentRoundComplete =
    currentRoundMatches.length > 0 &&
    currentRoundMatches.every((match) => match.status === "COMPLETED");
  const currentRoundWinners = currentRoundMatches.filter(
    (match) => match.winnerId !== null,
  ).length;
  const canStartNextRound =
    currentRoundComplete && currentRoundWinners > 1;

  return (
    <main className="min-h-screen bg-[#070D24] px-6 py-10 text-[#EEF2FF] sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/admin/t/${tournament.id}`}
          className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]"
        >
          ← Back to tournament settings
        </Link>

        <header className="mt-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            Bracket management
          </p>
          <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            {currentRound === null
              ? "Tournament has not started."
              : `Current round: Round ${currentRound}`}
          </p>
          <div className="mt-5">
            <RoundControls
              tournamentId={tournament.id}
              currentRound={currentRound}
              canStartRoundOne={
                !tournament.checkInOpen &&
                tournament.participants.length > 0
              }
              canStartNextRound={canStartNextRound}
            />
          </div>
          {tournament.checkInOpen && currentRound === null && (
            <p className="mt-3 text-sm text-[#9FB0E6]">
              Close check-in in tournament settings before starting Round 1.
            </p>
          )}
          {currentRoundComplete &&
            currentRoundWinners === 1 &&
            currentRound !== null && (
              <p className="mt-3 text-sm text-emerald-300">
                Tournament complete: {playerName(currentRoundMatches.find(
                  (match) => match.winnerId !== null,
                )?.winner ?? null)} is the champion.
              </p>
            )}
        </header>

        {disputePanelMatches.length > 0 && (
          <DisputeResolutionPanel
            tournamentId={tournament.id}
            matches={disputePanelMatches}
          />
        )}

        <section className="mt-8 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <h2 className="text-xl font-semibold">Matches</h2>
          {tournament.matches.length === 0 ? (
            <p className="mt-4 text-[#9FB0E6]">
              No matches have been generated yet. Approved participants who have
              checked in: {tournament.participants.length}.
            </p>
          ) : (
            <div className="mt-5 space-y-8">
              {Array.from(
                new Set(tournament.matches.map((match) => match.roundNumber)),
              ).map((roundNumber) => {
                const roundMatches = tournament.matches.filter(
                  (match) => match.roundNumber === roundNumber,
                );

                return (
                  <section key={roundNumber}>
                    <h3 className="mb-3 text-lg font-semibold">
                      Round {roundNumber}
                      {roundNumber === currentRound ? " · Current" : ""}
                    </h3>
                    <ul className="space-y-3">
                      {roundMatches.map((match, index) => (
                        <li
                          key={match.id}
                          className="rounded-xl border border-[#243775] bg-[#070D24] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm text-[#9FB0E6]">
                              Match {index + 1}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(match.status)}`}
                            >
                              {match.status}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 font-semibold">
                            <span>{playerName(match.player1)}</span>
                            <span className="text-[#9FB0E6]">vs.</span>
                            <span>{playerName(match.player2)}</span>
                          </div>
                          {match.player2 === null ? (
                            <p className="mt-2 text-sm text-emerald-300">
                              Bye — {playerName(match.winner)} advanced automatically.
                            </p>
                          ) : match.winner ? (
                            <p className="mt-2 text-sm text-[#9FB0E6]">
                              Winner: {playerName(match.winner)}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
