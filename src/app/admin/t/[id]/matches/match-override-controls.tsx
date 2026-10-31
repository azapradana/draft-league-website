"use client";

import { useState } from "react";
import { useTransition } from "react";
import { declareMatchWinner } from "./actions";

export default function MatchOverrideControls({
  tournamentId,
  matchId,
  player1,
  player2,
  disabledReason,
}: {
  tournamentId: string;
  matchId: string;
  player1: { id: string; name: string };
  player2: { id: string; name: string };
  disabledReason: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function submitOverride(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const winnerId = String(formData.get("winnerId"));
    const winner = winnerId === player1.id ? player1 : player2;
    const player1Score = String(formData.get("player1Score"));
    const player2Score = String(formData.get("player2Score"));
    if (
      !window.confirm(
        `Confirm admin override: ${winner.name} wins ${player1Score}–${player2Score}?`,
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    startTransition(() => {
      void saveOverride(formData);
    });
  }

  async function saveOverride(formData: FormData) {
    try {
      const result = await declareMatchWinner(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      setIsOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The match override could not be saved. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (disabledReason) {
    return <p className="mt-4 text-sm text-[#9FB0E6]">{disabledReason}</p>;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="rounded-lg border border-[#F5C542] px-4 py-2 text-sm font-bold text-[#F5C542] hover:bg-[#F5C542]/10"
      >
        Declare winner
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setIsOpen(false);
            }
          }}
        >
          <section
            aria-labelledby={`override-title-${matchId}`}
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-[#40569A] bg-[#0C1638] p-6 shadow-2xl"
            role="dialog"
          >
            <h3 id={`override-title-${matchId}`} className="text-xl font-bold">
              Declare match winner
            </h3>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              This records an admin override and replaces this match result.
              Review the winner and final game score before confirming.
            </p>

            <form className="mt-5 space-y-4" onSubmit={submitOverride}>
              <input name="tournamentId" type="hidden" value={tournamentId} />
              <input name="matchId" type="hidden" value={matchId} />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Winner</span>
                <select
                  className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                  name="winnerId"
                  required
                >
                  <option value={player1.id}>{player1.name}</option>
                  <option value={player2.id}>{player2.name}</option>
                </select>
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Final game score</legend>
                <div className="grid grid-cols-2 gap-3">
                  {[player1, player2].map((player, index) => (
                    <label className="block" key={player.id}>
                      <span className="mb-2 block truncate text-sm text-[#9FB0E6]">
                        {player.name}
                      </span>
                      <input
                        aria-label={`${player.name} score`}
                        className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                        min="0"
                        max="2147483647"
                        name={index === 0 ? "player1Score" : "player2Score"}
                        required
                        step="1"
                        type="number"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              {error && (
                <p className="rounded-lg border border-red-500/60 bg-red-950/40 p-3 text-sm text-red-200" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  className="rounded-lg border border-[#40569A] px-4 py-2 text-sm font-semibold text-[#CBD5F5] hover:bg-[#122050] disabled:opacity-50"
                  disabled={pending}
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-[#F5C542] px-4 py-2 text-sm font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "Saving override…" : "Confirm override"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
