"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MatchChat, { type MatchMessage } from "@/components/MatchChat";
import GroupBadge from "@/components/GroupBadge";
import MatchRosterInspector, { type MatchPlayer } from "@/components/MatchRosterInspector";
import { usePersonalWallet } from "@/components/wallet/personal-wallet";

type MatchData = {
  id: string;
  roundNumber: number;
  status: "PENDING" | "COMPLETED" | "DISPUTED";
  winnerId: string | null;
  winnerName: string | null;
  player1Vote: string | null;
  player2Vote: string | null;
  player1DrawVote: boolean;
  player2DrawVote: boolean;
  isDraw: boolean;
  isFriendlyMatch: boolean;
  tournamentName: string;
  player1: MatchPlayer;
  player2: MatchPlayer;
};

function statusStyle(status: MatchData["status"]) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/50 bg-emerald-950/60 text-emerald-300";
    case "DISPUTED":
      return "border-red-500/50 bg-red-950/60 text-red-200";
    default:
      return "border-[#F5C542]/50 bg-[#F5C542]/10 text-[#F5C542]";
  }
}

export default function MatchRoom({
  tournamentId,
  match,
  initialMessages,
  currentUserId,
  isAdmin,
}: {
  tournamentId: string;
  match: MatchData;
  initialMessages: MatchMessage[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const { setBalance: setWalletBalance } = usePersonalWallet();
  const [matchStatus, setMatchStatus] = useState(match.status);
  const [winnerId, setWinnerId] = useState(match.winnerId);
  const [player1Vote, setPlayer1Vote] = useState(match.player1Vote);
  const [player2Vote, setPlayer2Vote] = useState(match.player2Vote);
  const [player1DrawVote, setPlayer1DrawVote] = useState(match.player1DrawVote);
  const [player2DrawVote, setPlayer2DrawVote] = useState(match.player2DrawVote);
  const [isDraw, setIsDraw] = useState(match.isDraw);
  const [voting, setVoting] = useState(false);
  const [resultError, setResultError] = useState("");
  const endpoint = `/api/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}/chat`;
  const matchEndpoint = `/api/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}`;
  const resultEndpoint = `${matchEndpoint}/result`;

  useEffect(() => {
    let active = true;

    async function refreshMatch() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch(matchEndpoint, { cache: "no-store" });
        const result = (await response.json()) as
          | { match: MatchData }
          | { error: string };
        if (!response.ok || !("match" in result)) {
          throw new Error("error" in result ? result.error : "Match result could not be refreshed.");
        }
        if (active) {
          setMatchStatus(result.match.status);
          setWinnerId(result.match.winnerId);
          setPlayer1Vote(result.match.player1Vote);
          setPlayer2Vote(result.match.player2Vote);
          setPlayer1DrawVote(result.match.player1DrawVote);
          setPlayer2DrawVote(result.match.player2DrawVote);
          setIsDraw(result.match.isDraw);
        }
      } catch (error) {
        if (active) {
          setResultError(
            error instanceof Error
              ? error.message
              : "Match result could not be refreshed. Please try again.",
          );
        }
      }
    }

    const intervalId = window.setInterval(() => void refreshMatch(), 5000);
    document.addEventListener("visibilitychange", refreshMatch);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshMatch);
    };
  }, [matchEndpoint]);

  async function submitResult(outcome: "WIN" | "LOSS" | "DRAW") {
    if (voting) {
      return;
    }

    setVoting(true);
    setResultError("");
    try {
      const response = await fetch(resultEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const result = (await response.json()) as
        | {
            status: MatchData["status"];
            winnerId: string | null;
            player1Vote: string | null;
            player2Vote: string | null;
            player1DrawVote: boolean;
            player2DrawVote: boolean;
            isDraw: boolean;
            walletBalance: number;
          }
        | { error: string };
      if (
        !response.ok ||
        !("status" in result) ||
        !("winnerId" in result) ||
        !("player1Vote" in result) ||
        !("player2Vote" in result) ||
        !("player1DrawVote" in result) ||
        !("player2DrawVote" in result) ||
        !("isDraw" in result)
      ) {
        throw new Error("error" in result ? result.error : "Your result could not be submitted.");
      }

      setMatchStatus(result.status);
      setWinnerId(result.winnerId);
      setPlayer1Vote(result.player1Vote);
      setPlayer2Vote(result.player2Vote);
      setPlayer1DrawVote(result.player1DrawVote);
      setPlayer2DrawVote(result.player2DrawVote);
      setIsDraw(result.isDraw);
      setWalletBalance(result.walletBalance);
    } catch (error) {
      setResultError(
        error instanceof Error
          ? error.message
          : "Your result could not be submitted. Please try again.",
      );
    } finally {
      setVoting(false);
    }
  }

  const ownPlayer =
    match.player1?.isCurrentUser ? match.player1 : match.player2?.isCurrentUser ? match.player2 : null;
  const opponent =
    match.player1?.isCurrentUser
      ? match.player2
      : match.player2?.isCurrentUser
        ? match.player1
        : null;
  const rosterTabs = ownPlayer
    ? [
        { key: "mine", player: ownPlayer, label: "My Roster" },
        { key: "opponent", player: opponent, label: "Opponent Roster" },
      ]
    : [
        { key: "p1", player: match.player1, label: "Player 1 Roster" },
        { key: "p2", player: match.player2, label: "Player 2 Roster" },
      ];
  const ownVote = match.player1?.isCurrentUser
    ? player1Vote
    : match.player2?.isCurrentUser
      ? player2Vote
      : null;
  const ownDrawVote = match.player1?.isCurrentUser
    ? player1DrawVote
    : match.player2?.isCurrentUser
      ? player2DrawVote
      : false;
  const reportedWinnerName =
    winnerId === match.player1?.id
      ? match.player1.name
      : winnerId === match.player2?.id
        ? match.player2.name
        : null;

  return (
    <div className="space-y-3">
      <Link
        href={`/t/${encodeURIComponent(tournamentId)}`}
        className="inline-flex text-xs font-semibold text-[#9FB0E6] hover:text-[#EEF2FF]"
      >
        ← Back to tournament overview
      </Link>

      {resultError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/60 bg-red-950/40 p-2 text-xs text-red-200"
        >
          {resultError}
        </p>
      )}

      <header className="rounded-xl border border-[#243775] bg-[#0C1638] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#F5C542]">
              {match.tournamentName}
            </p>
            <h1 className="truncate text-base font-bold">
              Round {match.roundNumber} ·{" "}
              <span className="font-normal text-[#9FB0E6]">
                {ownPlayer
                  ? opponent
                    ? `vs ${opponent.name}`
                    : "Bye round"
                  : `${match.player1?.name ?? "Bye"} vs ${match.player2?.name ?? "Bye"}`}
              </span>
              {ownPlayer && opponent && (
                <span className="ml-2 inline-flex gap-1 align-middle">
                  <GroupBadge group={ownPlayer.group} />
                  <span className="text-[0.65rem] text-[#9FB0E6]">vs</span>
                  <GroupBadge group={opponent.group} />
                </span>
              )}
              {!ownPlayer && match.player1 && match.player2 && (
                <span className="ml-2 inline-flex gap-1 align-middle">
                  <GroupBadge group={match.player1.group} />
                  <span className="text-[0.65rem] text-[#9FB0E6]">vs</span>
                  <GroupBadge group={match.player2.group} />
                </span>
              )}
            </h1>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold ${statusStyle(matchStatus)}`}
          >
            {matchStatus}
          </span>
        </div>
        {matchStatus === "COMPLETED" && isDraw && (
          <p className="mt-1 text-xs font-semibold text-amber-300">Result: Draw</p>
        )}
        {matchStatus === "COMPLETED" &&
          !isDraw &&
          (reportedWinnerName ?? match.winnerName) && (
          <p className="mt-1 text-xs font-semibold text-emerald-300">
            Winner: {reportedWinnerName ?? match.winnerName}
          </p>
        )}
        {matchStatus === "DISPUTED" && (
          <p role="alert" className="mt-1 text-xs font-semibold text-red-200">
            Conflict detected — admins have been notified.
          </p>
        )}
        {isAdmin && (
          <Link
            href={`/admin/t/${encodeURIComponent(tournamentId)}/matches`}
            className="mt-1 inline-flex text-xs font-semibold text-[#9FB0E6] hover:text-[#F5C542]"
          >
            Open bracket management →
          </Link>
        )}
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MatchChat
          endpoint={endpoint}
          initialMessages={initialMessages}
          currentUserId={currentUserId}
          playerIds={[match.player1?.id, match.player2?.id].filter(
            (id): id is string => Boolean(id),
          )}
        />
        <div className="space-y-3">
          {ownPlayer && opponent && (
            <section className="rounded-xl border border-[#243775] bg-[#0C1638] p-3">
              <h2 className="text-sm font-bold">Confirm match result</h2>
              {matchStatus === "PENDING" && ownVote ? (
                <p className="mt-1 text-xs text-[#9FB0E6]">
                  Your vote: {ownDrawVote
                    ? "you reported a draw"
                    : ownVote === ownPlayer.id
                      ? "you reported a win"
                      : "you reported a loss"}.
                  {(player1Vote || player1DrawVote) && (player2Vote || player2DrawVote)
                    ? " Waiting for the result to update."
                    : " Waiting for opponent confirmation."}
                </p>
              ) : matchStatus === "PENDING" && ownDrawVote ? (
                <p className="mt-1 text-xs text-[#9FB0E6]">
                  Your vote: you reported a draw. Waiting for opponent confirmation.
                </p>
              ) : matchStatus === "PENDING" ? (
                <>
                  <p className="mt-1 text-xs text-[#9FB0E6]">
                    The match completes when both players agree.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={voting}
                      onClick={() => void submitResult("WIN")}
                      className="rounded-lg bg-[#F5C542] px-3 py-1.5 text-sm font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {voting ? "Submitting…" : "Report Win"}
                    </button>
                    <button
                      type="button"
                      disabled={voting}
                      onClick={() => void submitResult("LOSS")}
                      className="rounded-lg border border-[#9FB0E6] px-3 py-1.5 text-sm font-bold text-[#EEF2FF] hover:border-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Report Loss
                    </button>
                    {match.isFriendlyMatch && (
                      <button
                        type="button"
                        disabled={voting}
                        onClick={() => void submitResult("DRAW")}
                        className="rounded-lg border border-[#9FB0E6] px-3 py-1.5 text-sm font-bold text-[#EEF2FF] hover:border-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Report Draw
                      </button>
                    )}
                  </div>
                </>
              ) : matchStatus === "DISPUTED" ? (
                <p className="mt-1 text-xs font-semibold text-red-200">
                  Conflict detected — admins have been notified.
                </p>
              ) : (
                <p className="mt-1 text-xs text-emerald-300">
                  {isDraw
                    ? "Result confirmed as a draw."
                    : match.isFriendlyMatch
                      ? `Result confirmed for ${reportedWinnerName ?? "the winning player"}'s group.`
                      : `Result confirmed. ${reportedWinnerName ?? "The winner"} advances in the bracket.`}
                </p>
              )}
            </section>
          )}

          <MatchRosterInspector tabs={rosterTabs} />
        </div>
      </div>
    </div>
  );
}
