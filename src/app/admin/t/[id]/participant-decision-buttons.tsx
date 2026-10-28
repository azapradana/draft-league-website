"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ParticipantDecisionButtons({
  participantId,
  tournamentId,
}: {
  participantId: string;
  tournamentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "APPROVED" | "REJECTED") {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/participants/${participantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to update this request.");
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
      <div className="flex gap-3">
        <button
          className="rounded-lg bg-[#F5C542] px-4 py-2 text-sm font-bold text-[#070D24] disabled:opacity-60"
          disabled={pending}
          onClick={() => decide("APPROVED")}
          type="button"
        >
          Approve
        </button>
        <button
          className="rounded-lg border border-[#9FB0E6] px-4 py-2 text-sm font-semibold text-[#EEF2FF] disabled:opacity-60"
          disabled={pending}
          onClick={() => decide("REJECTED")}
          type="button"
        >
          Decline
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
