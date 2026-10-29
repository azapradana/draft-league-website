"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoundControls({
  tournamentId,
  currentRound,
  showRoundControl,
  canStartRoundOne,
  canStartNextRound,
  canGenerateTopCut,
  topCut,
}: {
  tournamentId: string;
  currentRound: number | null;
  showRoundControl: boolean;
  canStartRoundOne: boolean;
  canStartNextRound: boolean;
  canGenerateTopCut: boolean;
  topCut: number;
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

  async function generateTopCut() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/top-cut/generate`,
        { method: "POST" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to generate the Top Cut bracket.");
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
    <div className="flex flex-wrap gap-3">
      {showRoundControl ? (
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
      ) : null}
      {topCut > 0 && (
        <button
          className="rounded-lg border border-[#F5C542] px-5 py-3 font-bold text-[#F5C542] hover:bg-[#F5C542]/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canGenerateTopCut || pending}
          onClick={generateTopCut}
          type="button"
        >
          {pending ? "Generating bracket…" : `Generate Top ${topCut} Bracket`}
        </button>
      )}
      {error && (
        <p className="basis-full text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
