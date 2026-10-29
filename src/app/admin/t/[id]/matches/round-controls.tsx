"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoundControls({
  tournamentId,
  currentRound,
  canStartRoundOne,
  canStartNextRound,
}: {
  tournamentId: string;
  currentRound: number | null;
  canStartRoundOne: boolean;
  canStartNextRound: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateRound() {
    setPending(true);
    setError(null);

    try {
      const endpoint =
        currentRound === null ? "start" : "generate";
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/rounds/${endpoint}`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        error?: string;
        roundNumber?: number;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to generate the tournament round.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const canGenerate =
    currentRound === null ? canStartRoundOne : canStartNextRound;

  return (
    <div>
      <button
        className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canGenerate || pending}
        onClick={generateRound}
        type="button"
      >
        {pending
          ? "Generating round…"
          : currentRound === null
            ? "Start Tournament / Generate Round 1"
            : "Start Next Round"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
