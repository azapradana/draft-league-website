"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTabNotification } from "@/hooks/useTabNotification";

const POLL_INTERVAL_MS = 30_000;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function RoundNotificationBanner({
  tournamentId,
  round,
  label,
}: {
  tournamentId: string;
  round: number;
  label: string;
}) {
  const router = useRouter();
  const storageKey = `round-banner-dismissed:${tournamentId}:${round}`;
  const [dismissedNow, setDismissedNow] = useState<string | null>(null);
  const storedDismissed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey) === "1",
    () => true,
  );
  const dismissed = storedDismissed || dismissedNow === storageKey;
  const message = `${label} Started!`;

  useTabNotification(dismissed ? 0 : 1, message);

  // Pick up newly started rounds without requiring a manual reload.
  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [router]);

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable; dismissal only lasts for this page view.
    }
    setDismissedNow(storageKey);
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 rounded-xl border border-[#F5C542]/60 bg-[#F5C542]/10 px-4 py-3 text-sm font-semibold text-[#F5C542]"
    >
      <span>{message} Check the bracket for your pairing.</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss round notification"
        className="rounded p-1 text-[#F5C542] hover:bg-[#F5C542]/20"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
