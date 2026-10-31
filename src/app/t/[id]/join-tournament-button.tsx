"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinTournamentButton({
  tournamentId,
  label = "Join Tournament",
}: {
  tournamentId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function joinTournament() {
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        status?: "PENDING" | "APPROVED";
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to submit your request. Please try again.");
        return;
      }

      setNotice(
        result.status === "PENDING"
          ? "Your registration is pending organizer approval."
          : label === "Join War"
            ? "You are now in the Friendly Match queue."
            : "You are now registered for this tournament.",
      );
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
        onClick={joinTournament}
        type="button"
      >
        {pending ? "Joining…" : label}
      </button>
      {notice && (
        <p className="mt-3 text-sm text-emerald-300" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
