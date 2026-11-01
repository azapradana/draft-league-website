"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartTournamentButton({
  tournamentId,
  isFriendlyMatch,
  started,
  completed,
}: {
  tournamentId: string;
  isFriendlyMatch: boolean;
  started: boolean;
  completed: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabledReason = completed
    ? "This tournament is completed and can no longer be started."
    : started
      ? "This tournament has already started."
      : null;

  const warning = isFriendlyMatch
    ? "Starting generates the one-time Friendly Match pairings. Players who join afterwards go on the substitute bench. This cannot be undone."
    : "Starting closes registration and check-in. Players still pending approval will not be paired. This cannot be undone.";

  async function start() {
    if (!window.confirm(`Start this tournament?\n\n${warning}`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "startTournament", id: tournamentId }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to start the tournament.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || disabledReason !== null}
        onClick={() => void start()}
        title={disabledReason ?? undefined}
        type="button"
      >
        {pending ? "Starting…" : started ? "Started" : "Start tournament"}
      </button>
      {disabledReason ? (
        <p className="mt-2 text-sm text-[#9FB0E6]">{disabledReason}</p>
      ) : (
        <p className="mt-2 max-w-xl text-sm text-amber-200">{warning}</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
