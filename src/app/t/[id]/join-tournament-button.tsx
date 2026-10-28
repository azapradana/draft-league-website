"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinTournamentButton({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestToJoin() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to submit your request. Please try again.");
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
    <div className="mt-5">
      <button
        className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EEF2FF]"
        disabled={pending}
        onClick={requestToJoin}
        type="button"
      >
        {pending ? "Submitting…" : "Request to join"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
