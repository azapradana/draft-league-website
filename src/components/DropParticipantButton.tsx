"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DropParticipantButton({
  endpoint,
  buttonLabel,
  title,
  description,
  confirmLabel,
  compact = false,
}: {
  endpoint: string;
  buttonLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function drop() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to drop. Please try again.");
        return;
      }

      dialogRef.current?.close();
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
        className={`rounded-lg border border-red-400/60 font-semibold text-red-200 transition hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] ${
          compact ? "px-3 py-1.5 text-xs" : "px-5 py-3 text-sm"
        }`}
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-[#243775] bg-[#0C1638] p-6 text-[#EEF2FF] shadow-2xl backdrop:bg-[#030817]/80"
      >
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm text-[#9FB0E6]">{description}</p>
        {error && (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-[#243775] px-4 py-2 text-sm text-[#EEF2FF] hover:border-[#F5C542] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={drop}
            className="rounded-lg bg-[#F5C542] px-4 py-2 text-sm font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Dropping…" : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
