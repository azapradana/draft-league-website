"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePackButton({
  packId,
  tournamentId,
  packName,
}: {
  packId: string;
  tournamentId: string;
  packName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deletePack() {
    if (
      !window.confirm(
        `Delete "${packName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "deletePack",
          id: packId,
          tournamentId,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "The pack could not be deleted.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The pack could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={deletePack}
        disabled={deleting}
        className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "Delete pack"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
