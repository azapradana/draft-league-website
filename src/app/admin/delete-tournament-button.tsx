"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTournamentButton({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteTournament() {
    const confirmed = window.confirm(
      `Permanently delete "${tournamentName}" and its participants, matches, and tournament records? Existing player wallet balances will not be changed.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "deleteTournament", id: tournamentId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "The tournament could not be deleted.");
      }
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The tournament could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => void deleteTournament()}
        disabled={deleting}
        className="inline-flex items-center rounded-lg border border-red-500/60 px-4 py-2 font-semibold text-red-300 transition hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && <p role="alert" className="mt-2 max-w-56 text-right text-xs text-red-300">{error}</p>}
    </div>
  );
}
