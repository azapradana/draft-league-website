"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type DisputedMatch = {
  id: string;
  roundNumber: number;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  player1Vote: string | null;
  player2Vote: string | null;
  messages: Array<{
    id: string;
    senderName: string;
    content: string;
    timestamp: string;
  }>;
};

function voteName(match: DisputedMatch, vote: string | null) {
  if (!vote) {
    return "No vote submitted";
  }
  if (vote === match.player1?.id) {
    return match.player1.name;
  }
  if (vote === match.player2?.id) {
    return match.player2.name;
  }
  return "Unknown player";
}

export default function DisputeResolutionPanel({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: DisputedMatch[];
}) {
  const router = useRouter();
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function resolveMatch(match: DisputedMatch, winnerId: string) {
    if (pendingMatchId) {
      return;
    }

    setPendingMatchId(match.id);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ winnerId }),
        },
      );
      const result = (await response.json()) as { error?: string; status?: string };
      if (!response.ok || result.status !== "COMPLETED") {
        throw new Error(result.error ?? "The disputed match could not be resolved.");
      }

      router.refresh();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "The disputed match could not be resolved. Please try again.",
      );
    } finally {
      setPendingMatchId(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-red-500/50 bg-red-950/20 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-red-200">Disputed match alerts</h2>
          <p className="mt-1 text-sm text-[#9FB0E6]">
            Review both votes and match chat, then set the correct winner to advance the bracket.
          </p>
        </div>
        <span className="rounded-full bg-red-950 px-3 py-1 text-sm font-bold text-red-200">
          {matches.length} pending
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <ul className="mt-5 space-y-5">
        {matches.map((match) => (
          <li key={match.id} className="rounded-xl border border-red-500/30 bg-[#070D24] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                Round {match.roundNumber}: {match.player1?.name ?? "Unknown player"} vs.{" "}
                {match.player2?.name ?? "Unknown player"}
              </h3>
              <Link
                href={`/t/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}`}
                className="text-sm font-semibold text-[#F5C542] hover:underline"
              >
                Open match room
              </Link>
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[#9FB0E6]">Player 1 vote</dt>
                <dd className="font-semibold">{voteName(match, match.player1Vote)}</dd>
              </div>
              <div>
                <dt className="text-[#9FB0E6]">Player 2 vote</dt>
                <dd className="font-semibold">{voteName(match, match.player2Vote)}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <h4 className="text-sm font-semibold">Match chat history</h4>
              {match.messages.length === 0 ? (
                <p className="mt-2 text-sm text-[#9FB0E6]">No chat messages were sent.</p>
              ) : (
                <ol className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[#243775] bg-[#0C1638] p-3">
                  {match.messages.map((message) => (
                    <li key={message.id} className="text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-semibold">{message.senderName}</span>
                        <time className="text-xs text-[#9FB0E6]" dateTime={message.timestamp}>
                          {new Date(message.timestamp).toLocaleString("en-US", {
                            timeZone: "UTC",
                          })}{" "}
                          UTC
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[#CBD5F5]">
                        {message.content}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {[match.player1, match.player2].map((player) => (
                <button
                  key={player?.id ?? "missing-player"}
                  type="button"
                  disabled={!player || pendingMatchId !== null}
                  onClick={() => player && void resolveMatch(match, player.id)}
                  className="rounded-lg bg-[#F5C542] px-4 py-2 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingMatchId === match.id
                    ? "Resolving…"
                    : `Set ${player?.name ?? "missing player"} as winner`}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
