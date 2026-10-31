"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SwissRoundTabs, { type SwissRoundTab } from "@/components/SwissRoundTabs";
import MatchOverrideControls from "./match-override-controls";

type AdminMatch = {
  id: string;
  roundNumber: number;
  roundLabel: string;
  isTopCut: boolean;
  tableNumber: number | null;
  status: string;
  isDraw: boolean;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  winner: { id: string; name: string } | null;
  player1Score: number | null;
  player2Score: number | null;
  adminOverrideBy: string | null;
  adminOverrideAt: string | null;
  disabledReason: string | null;
};

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

export default function MatchesRoster({
  tournamentId,
  matches,
  plannedRounds,
  initialRound,
}: {
  tournamentId: string;
  matches: AdminMatch[];
  plannedRounds: { roundNumber: number; label: string; group?: string }[];
  initialRound: string;
}) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const refreshInterval = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(refreshInterval);
  }, [router]);

  const roundNumbers = [
    ...new Set([
      ...matches.map((match) => match.roundNumber),
      ...plannedRounds.map((round) => round.roundNumber),
    ]),
  ].sort((a, b) => a - b);

  if (roundNumbers.length === 0) {
    return (
      <p className="mt-4 text-[#9FB0E6]">
        No matches have been generated yet. Start a round to populate the match roster.
      </p>
    );
  }

  return (
    <SwissRoundTabs
      initialRound={initialRound}
      tabs={roundNumbers.map((roundNumber): SwissRoundTab => {
        const roundMatches = matches.filter(
          (match) => match.roundNumber === roundNumber,
        );
        const status =
          roundMatches.length === 0
            ? "upcoming"
            : roundMatches.every((match) => match.status === "COMPLETED")
              ? "completed"
              : "in-progress";

        return {
          value: String(roundNumber),
          label:
            roundMatches[0]?.roundLabel ??
            plannedRounds.find((round) => round.roundNumber === roundNumber)?.label ??
            `Round ${roundNumber}`,
          status,
          group:
            roundMatches[0]?.isTopCut ||
            plannedRounds.find((round) => round.roundNumber === roundNumber)?.group ===
              "top-cut"
              ? "top-cut"
              : "swiss",
          content: roundMatches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#243775] p-5 text-[#9FB0E6]">
                Pairings for this round have not been generated yet.
              </p>
            ) : (
              <section>
                <h3 className="mb-3 text-lg font-semibold">
                  {roundMatches[0].roundLabel}
                  {status === "in-progress" ? " · In progress" : " · Complete"}
                </h3>
                <ul className="space-y-3">
                  {roundMatches.map((match) => (
                    <li
                      key={match.id}
                      className="rounded-xl border border-[#243775] bg-[#070D24] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#9FB0E6]">
                          {match.player2 ? `Table ${match.tableNumber}` : "Bye"}
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                          {match.player2 && (
                            <Link
                              className="text-sm font-semibold text-[#F5C542] hover:underline"
                              href={`/t/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}`}
                            >
                              Open match room
                            </Link>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {(match.adminOverrideBy || match.adminOverrideAt) && (
                              <span className="rounded-full border border-amber-400/50 bg-amber-950/50 px-3 py-1 text-xs font-bold text-amber-200">
                                Admin override
                              </span>
                            )}
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(match.status)}`}
                            >
                              {match.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 font-semibold">
                        <span>{match.player1?.name ?? "Unassigned"}</span>
                        <span className="text-[#9FB0E6]">vs.</span>
                        <span>{match.player2?.name ?? "Bye"}</span>
                      </div>

                      {match.player2 === null ? (
                        <p className="mt-2 text-sm text-emerald-300">
                          {match.winner?.name ?? match.player1?.name ?? "Player"} advanced automatically.
                        </p>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-[#CBD5F5]">
                            {match.isDraw
                              ? "Result: Draw"
                              : `Score: ${
                                  match.player1Score !== null && match.player2Score !== null
                                    ? `${match.player1Score}–${match.player2Score}`
                                    : "Not recorded"
                                }${match.winner ? ` · Winner: ${match.winner.name}` : ""}`}
                          </p>
                          {(match.adminOverrideBy || match.adminOverrideAt) && (
                            <p className="mt-1 text-xs text-amber-200/80">
                              Manually set by {match.adminOverrideBy ?? "an administrator"}
                              {match.adminOverrideAt
                                ? ` · ${
                                    hasMounted
                                      ? new Date(match.adminOverrideAt).toLocaleString()
                                      : match.adminOverrideAt
                                  }`
                                : ""}
                            </p>
                          )}
                          {match.player1 && match.player2 && (
                            <MatchOverrideControls
                              disabledReason={match.disabledReason}
                              matchId={match.id}
                              player1={match.player1}
                              player2={match.player2}
                              tournamentId={tournamentId}
                            />
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ),
        };
      })}
    />
  );
}
