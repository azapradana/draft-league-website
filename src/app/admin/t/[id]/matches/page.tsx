import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ParticipantStatus } from "@prisma/client";
import MatchesRoster from "./matches-roster";
import RoundControls from "./round-controls";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildSwissStandings,
  hasCompletedSwissRounds,
} from "@/lib/tournament-standings";
import { SwissStandingsTable } from "@/app/t/[id]/standings/standings-table";

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
      completed: true,
      checkInOpen: true,
      format: true,
      swissRounds: true,
      topCut: true,
      currentStage: true,
      participants: {
        where: {
          status: ParticipantStatus.APPROVED,
          checkedIn: true,
        },
        select: {
          id: true,
          user: { select: { name: true, username: true, email: true } },
        },
      },
      matches: {
        orderBy: [
          { roundNumber: "asc" },
          { bracketPosition: "asc" },
          { createdAt: "asc" },
        ],
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
          adminOverrideBy: {
            select: { name: true, username: true, email: true },
          },
        },
      },
    },
  });

  if (!tournament) {
    notFound();
  }

  const stageMatches = tournament.matches.filter(
    (match) =>
      match.stage === "SWISS" ||
      (match.stage === null &&
        tournament.format === "SWISS" &&
        match.roundNumber <= tournament.swissRounds),
  );
  const swissStageComplete =
    tournament.format === "SWISS" &&
    hasCompletedSwissRounds(stageMatches, tournament.swissRounds);
  const matchesToDisplay =
    tournament.format === "SWISS" && !swissStageComplete
      ? tournament.matches.filter((match) => match.stage !== "TOP_CUT")
      : tournament.matches;
  const currentRound =
    matchesToDisplay.length > 0
      ? matchesToDisplay[matchesToDisplay.length - 1].roundNumber
      : null;
  const swissRoundNumbers = [
    ...new Set(stageMatches.map((match) => match.roundNumber)),
  ];
  const topCutRoundNumbers = [
    ...new Set(
      matchesToDisplay
        .filter((match) => match.stage === "TOP_CUT")
        .map((match) => match.roundNumber),
    ),
  ];
  const currentStage =
    tournament.format === "SWISS" &&
    (!swissStageComplete ||
      tournament.currentStage === "SINGLE_ELIMINATION")
      ? "SWISS"
      : tournament.currentStage;
  const currentRoundMatches = matchesToDisplay.filter(
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
  const canStartRoundOne =
    currentRound === null &&
    !tournament.checkInOpen &&
    tournament.participants.length > 0;
  const canStartAnotherRound =
    currentStage === "SWISS"
      ? swissRoundNumbers.length < tournament.swissRounds
      : currentStage === "TOP_CUT"
        ? canStartNextRound
        : currentStage === "SINGLE_ELIMINATION" &&
          canStartNextRound;
  const canGenerateTopCut =
    tournament.format === "SWISS" &&
    currentStage === "SWISS" &&
    tournament.topCut > 0 &&
    swissStageComplete &&
    currentRoundComplete;
  const showRoundControl =
    currentRound === null
      ? canStartRoundOne
      : currentStage === "SWISS"
        ? swissRoundNumbers.length < tournament.swissRounds
        : currentStage === "TOP_CUT" ||
          currentStage === "SINGLE_ELIMINATION";
  const standings =
    tournament.format === "SWISS"
      ? buildSwissStandings(
          tournament.participants,
          stageMatches.map((match) => ({
            ...match,
            stage: "SWISS",
          })),
        )
      : [];
  const tableNumbers = new Map<number, number>();
  const rosterMatches = matchesToDisplay.map((match) => {
    const tableNumber = match.player2
      ? (tableNumbers.get(match.roundNumber) ?? 0) + 1
      : null;
    if (tableNumber !== null) {
      tableNumbers.set(match.roundNumber, tableNumber);
    }
    const isSwiss =
      match.stage === "SWISS" ||
      (match.stage === null &&
        tournament.format === "SWISS" &&
        match.roundNumber <= tournament.swissRounds);
    const isTopCut = match.stage === "TOP_CUT";
    const roundLabel = isTopCut
      ? `Top Cut · Round ${topCutRoundNumbers.indexOf(match.roundNumber) + 1}`
      : isSwiss
        ? `Swiss · Round ${match.roundNumber}`
        : `Single Elimination · Round ${match.roundNumber}`;
    const hasLaterRound = tournament.matches.some(
      (laterMatch) => laterMatch.roundNumber > match.roundNumber,
    );

    return {
      id: match.id,
      roundNumber: match.roundNumber,
      roundLabel,
      tableNumber,
      status: match.status,
      player1: match.player1
        ? { id: match.player1.id, name: playerName(match.player1) }
        : null,
      player2: match.player2
        ? { id: match.player2.id, name: playerName(match.player2) }
        : null,
      winner: match.winner
        ? { id: match.winner.id, name: playerName(match.winner) }
        : null,
      player1Score: match.player1Score,
      player2Score: match.player2Score,
      adminOverrideBy: match.adminOverrideBy
        ? playerName({ user: match.adminOverrideBy })
        : null,
      adminOverrideAt: match.adminOverrideAt?.toISOString() ?? null,
      disabledReason: tournament.completed
        ? "This tournament is complete; match results are read-only."
        : hasLaterRound
          ? "This match has already fed into a later round and is read-only."
          : null,
    };
  });

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
              : `${currentStage.replace(/_/g, " ")} · Round ${currentRound}`}
          </p>
          <div className="mt-5">
            <RoundControls
              tournamentId={tournament.id}
              currentRound={currentRound}
              showRoundControl={showRoundControl}
              canStartRoundOne={canStartRoundOne}
              canStartNextRound={canStartNextRound && canStartAnotherRound}
              canGenerateTopCut={canGenerateTopCut}
              topCut={
                currentStage === "SWISS" ? tournament.topCut : 0
              }
            />
          </div>
          {tournament.checkInOpen && currentRound === null && (
            <p className="mt-3 text-sm text-[#9FB0E6]">
              Close check-in in tournament settings before starting Round 1.
            </p>
          )}
          {currentStage === "COMPLETED" &&
            currentRoundComplete &&
            currentRoundWinners === 1 &&
            currentRound !== null && (
              <p className="mt-3 text-sm text-emerald-300">
                Tournament complete:{" "}
                {tournament.format === "SWISS" && tournament.topCut === 0
                  ? standings[0]?.user.name ??
                    standings[0]?.user.username ??
                    "The top-ranked player"
                  : playerName(
                      currentRoundMatches.find(
                        (match) => match.winnerId !== null,
                      )?.winner ?? null,
                    )}{" "}
                is the champion.
              </p>
            )}
        </header>

        {tournament.format === "SWISS" && (
          <section className="mt-8 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">Swiss standings</h2>
              <p className="mt-1 text-sm text-[#9FB0E6]">
                Ranked by match points, then opponent match-win percentage
                (33.3% minimum).
              </p>
            </div>
            <SwissStandingsTable
              standings={standings}
              topCut={tournament.topCut}
            />
          </section>
        )}

        <section
          id="brackets"
          className="mt-8 scroll-mt-6 rounded-2xl border border-[#243775] bg-[#0C1638] p-6"
        >
          <h2 className="text-xl font-semibold">Matches</h2>
          {matchesToDisplay.length === 0 && (
            <p className="mt-4 text-[#9FB0E6]">
              Approved participants who have checked in: {tournament.participants.length}.
            </p>
          )}
          <MatchesRoster matches={rosterMatches} tournamentId={tournament.id} />
        </section>
      </div>
    </main>
  );
}
