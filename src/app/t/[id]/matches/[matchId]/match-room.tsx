"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import PokemonArtwork, { type PokemonArtworkSpecies } from "../../pokemon-artwork";

type MatchPlayer = {
  id: string;
  isCurrentUser: boolean;
  name: string;
  roster: Array<
    PokemonArtworkSpecies & {
      types: string[];
      tiers: Array<{ name: string; color: string | null }>;
    }
  >;
} | null;

type MatchData = {
  id: string;
  roundNumber: number;
  status: "PENDING" | "COMPLETED" | "DISPUTED";
  winnerId: string | null;
  winnerName: string | null;
  player1Vote: string | null;
  player2Vote: string | null;
  tournamentName: string;
  player1: MatchPlayer;
  player2: MatchPlayer;
};

type MatchMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
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

function RosterInspector({
  player,
  label,
}: {
  player: MatchPlayer;
  label: string;
}) {
  return (
    <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F5C542]">{label}</p>
      <h3 className="mt-2 text-xl font-bold">{player?.name ?? "Bye"}</h3>
      {!player ? (
        <p className="mt-4 text-sm text-[#9FB0E6]">
          This bracket slot is a bye; no opponent roster is available.
        </p>
      ) : player.roster.length === 0 ? (
        <p className="mt-4 text-sm text-[#9FB0E6]">No roster has been selected.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {player.roster.slice(0, 6).map((pokemon) => (
            <li
              key={pokemon.dex}
              className="flex min-w-0 flex-col items-center rounded-xl border border-[#243775] bg-[#070D24] p-3 text-center"
            >
              <PokemonArtwork species={pokemon} className="h-20 w-20" />
              <span className="mt-2 break-words text-sm font-semibold">{pokemon.name}</span>
              <span className="text-xs text-[#9FB0E6]">#{pokemon.dex}</span>
              <span className="mt-2 flex flex-wrap justify-center gap-1">
                {pokemon.types.length > 0 ? (
                  pokemon.types.map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-[#243775] px-2 py-1 text-[0.65rem] font-semibold text-[#EEF2FF]"
                    >
                      {type}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#9FB0E6]">Type not recorded</span>
                )}
              </span>
              <span className="mt-2 flex flex-wrap justify-center gap-1">
                {pokemon.tiers.length > 0 ? (
                  pokemon.tiers.map((tier) => (
                    <span
                      key={`${tier.name}-${tier.color ?? ""}`}
                      className="rounded-full border px-2 py-1 text-[0.65rem] font-semibold"
                      style={{
                        borderColor: tier.color ?? "#9FB0E6",
                        color: tier.color ?? "#9FB0E6",
                      }}
                    >
                      {tier.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#9FB0E6]">Tier not recorded</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MatchRoom({
  tournamentId,
  match,
  initialMessages,
  isAdmin,
}: {
  tournamentId: string;
  match: MatchData;
  initialMessages: MatchMessage[];
  isAdmin: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [matchStatus, setMatchStatus] = useState(match.status);
  const [winnerId, setWinnerId] = useState(match.winnerId);
  const [player1Vote, setPlayer1Vote] = useState(match.player1Vote);
  const [player2Vote, setPlayer2Vote] = useState(match.player2Vote);
  const [voting, setVoting] = useState(false);
  const [resultError, setResultError] = useState("");
  const endpoint = `/api/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}/chat`;
  const matchEndpoint = `/api/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(match.id)}`;
  const resultEndpoint = `${matchEndpoint}/result`;

  useEffect(() => {
    let active = true;

    async function refreshMessages() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const result = (await response.json()) as
          | { messages: MatchMessage[] }
          | { error: string };
        if (!response.ok || !("messages" in result)) {
          throw new Error("error" in result ? result.error : "Chat could not be refreshed.");
        }
        if (active) {
          setMessages(result.messages);
          setChatError("");
        }
      } catch (error) {
        if (active) {
          setChatError(
            error instanceof Error
              ? error.message
              : "Chat could not be refreshed. Please try again.",
          );
        }
      }
    }

    const intervalId = window.setInterval(() => void refreshMessages(), 5000);
    document.addEventListener("visibilitychange", refreshMessages);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshMessages);
    };
  }, [endpoint]);

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

  async function submitResult(winnerParticipantId: string) {
    if (voting) {
      return;
    }

    setVoting(true);
    setResultError("");
    try {
      const response = await fetch(resultEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ winnerId: winnerParticipantId }),
      });
      const result = (await response.json()) as
        | {
            status: MatchData["status"];
            winnerId: string | null;
            player1Vote: string | null;
            player2Vote: string | null;
          }
        | { error: string };
      if (
        !response.ok ||
        !("status" in result) ||
        !("winnerId" in result) ||
        !("player1Vote" in result) ||
        !("player2Vote" in result)
      ) {
        throw new Error("error" in result ? result.error : "Your result could not be submitted.");
      }

      setMatchStatus(result.status);
      setWinnerId(result.winnerId);
      setPlayer1Vote(result.player1Vote);
      setPlayer2Vote(result.player2Vote);
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) {
      return;
    }

    setSending(true);
    setChatError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = (await response.json()) as
        | { message: MatchMessage }
        | { error: string };
      if (!response.ok || !("message" in result)) {
        throw new Error("error" in result ? result.error : "Your message could not be sent.");
      }

      setMessages((current) =>
        [...current.filter((message) => message.id !== result.message.id), result.message].slice(
          -100,
        ),
      );
      setDraft("");
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Your message could not be sent. Please try again.",
      );
    } finally {
      setSending(false);
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
  const rosterSides = ownPlayer
    ? [
        { player: ownPlayer, label: "Your selected roster" },
        { player: opponent, label: "Opponent roster" },
      ]
    : [
        { player: match.player1, label: "Player 1 roster" },
        { player: match.player2, label: "Player 2 roster" },
      ];
  const ownVote = match.player1?.isCurrentUser
    ? player1Vote
    : match.player2?.isCurrentUser
      ? player2Vote
      : null;
  const reportedWinnerName =
    winnerId === match.player1?.id
      ? match.player1.name
      : winnerId === match.player2?.id
        ? match.player2.name
        : null;

  return (
    <div className="space-y-6">
      <Link
        href={`/t/${encodeURIComponent(tournamentId)}`}
        className="inline-flex text-sm font-semibold text-[#9FB0E6] hover:text-[#EEF2FF]"
      >
        ← Back to tournament overview
      </Link>

      {resultError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/60 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {resultError}
        </p>
      )}

      <header className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          {match.tournamentName}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Round {match.roundNumber} match room</h1>
            <p className="mt-2 text-[#9FB0E6]">
              {ownPlayer
                ? opponent
                  ? `Your opponent is ${opponent.name}.`
                  : "You received a bye this round."
                : `Player 1: ${match.player1?.name ?? "Bye"} · Player 2: ${
                    match.player2?.name ?? "Bye"
                  }`}
            </p>
          </div>
          <span
            className={`rounded-full border px-4 py-2 text-sm font-bold ${statusStyle(matchStatus)}`}
          >
            {matchStatus}
          </span>
        </div>
        {matchStatus === "COMPLETED" && (reportedWinnerName ?? match.winnerName) && (
          <p className="mt-4 text-sm font-semibold text-emerald-300">
            Match completed · Winner: {reportedWinnerName ?? match.winnerName}
          </p>
        )}
        {matchStatus === "DISPUTED" && (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-200">
            Conflict detected — admins have been notified and will review the result.
          </p>
        )}
        {matchStatus === "PENDING" && (
          <p className="mt-4 text-sm text-[#9FB0E6]">
            Coordinate your match in chat, then confirm the result below.
          </p>
        )}
        {isAdmin && (
          <Link
            href={`/admin/t/${encodeURIComponent(tournamentId)}/matches`}
            className="mt-4 inline-flex rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#9FB0E6] hover:border-[#F5C542] hover:text-[#F5C542]"
          >
            Open bracket management
          </Link>
        )}
      </header>

      {ownPlayer && opponent && (
        <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
          <h2 className="text-xl font-bold">Confirm match result</h2>
          {matchStatus === "PENDING" && ownVote ? (
            <p className="mt-3 text-sm text-[#9FB0E6]">
              Your vote: {ownVote === ownPlayer.id ? "you reported a win" : "you reported a loss"}.
              {player1Vote && player2Vote
                ? " Waiting for the result to update."
                : " Waiting for opponent confirmation."}
            </p>
          ) : matchStatus === "PENDING" ? (
            <>
              <p className="mt-2 text-sm text-[#9FB0E6]">
                Report whether you won or lost. The match completes when both players agree.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={voting}
                  onClick={() => void submitResult(ownPlayer.id)}
                  className="rounded-xl bg-[#F5C542] px-5 py-2.5 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {voting ? "Submitting…" : "Report Win"}
                </button>
                <button
                  type="button"
                  disabled={voting}
                  onClick={() => void submitResult(opponent.id)}
                  className="rounded-xl border border-[#9FB0E6] px-5 py-2.5 font-bold text-[#EEF2FF] hover:border-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Report Loss
                </button>
              </div>
            </>
          ) : matchStatus === "DISPUTED" ? (
            <p className="mt-2 text-sm font-semibold text-red-200">
              Conflict detected — admins have been notified.
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-300">
              Result confirmed. {reportedWinnerName ?? "The winner"} advances in the bracket.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold">Roster inspector</h2>
        <p className="mt-1 text-sm text-[#9FB0E6]">
          View both selected battle rosters, including Pokémon types and collection tiers.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {rosterSides.map(({ player, label }, index) => (
            <RosterInspector
              key={`${player?.id ?? "bye"}-${index}`}
              player={player}
              label={label}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Match chat</h2>
            <p className="mt-1 text-sm text-[#9FB0E6]">
              Messages refresh automatically while this page is open. Times are shown in UTC.
            </p>
          </div>
          <span className="text-xs text-[#9FB0E6]">Refreshes every 5 seconds</span>
        </div>

        {chatError && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/60 bg-red-950/40 p-3 text-sm text-red-200">
            {chatError}
          </p>
        )}

        <ol
          aria-live="polite"
          className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-[#243775] bg-[#070D24] p-4"
        >
          {messages.length === 0 ? (
            <li className="text-sm text-[#9FB0E6]">
              No messages yet. Coordinate your match or say glhf!
            </li>
          ) : (
            messages.map((message) => (
              <li key={message.id} className="rounded-lg bg-[#0C1638] p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{message.senderName}</span>
                  <time
                    className="text-xs text-[#9FB0E6]"
                    dateTime={message.timestamp}
                  >
                    {new Date(message.timestamp).toLocaleString("en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.content}</p>
              </li>
            ))
          )}
        </ol>

        <form className="mt-4 space-y-3" onSubmit={(event) => void sendMessage(event)}>
          <label htmlFor="match-message" className="sr-only">
            Write a match chat message
          </label>
          <textarea
            id="match-message"
            maxLength={1000}
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message to your opponent..."
            className="w-full resize-y rounded-xl border border-[#243775] bg-[#070D24] p-3 text-sm text-[#EEF2FF] placeholder:text-[#7789BF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#9FB0E6]">{draft.length}/1000</span>
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="rounded-xl bg-[#F5C542] px-5 py-2.5 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
