"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ParticipantLineupButton({
  tournamentId,
  participantId,
  isForced,
}: {
  tournamentId: string;
  participantId: string;
  isForced: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function updateLineup() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(participantId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendlyMatchForcedLineup: !isForced }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to update the Friendly Match lineup.");
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
        type="button"
        disabled={pending}
        onClick={() => void updateLineup()}
        className="rounded-lg border border-[#F5C542] px-3 py-2 text-sm font-bold text-[#F5C542] disabled:opacity-60"
      >
        {pending ? "Saving…" : isForced ? "Remove lineup override" : "Force into lineup"}
      </button>
      {error && <p className="mt-1 text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
