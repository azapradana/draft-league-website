"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function postAdminAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The change could not be saved.");
}

export function GuestAccessButton({
  action,
  label,
  pendingLabel,
  payload,
  tone = "default",
  confirmMessage,
}: {
  action: "setInviteActive" | "unlockGuest";
  label: string;
  pendingLabel: string;
  payload: Record<string, unknown>;
  tone?: "default" | "danger";
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError("");
    try {
      await postAdminAction({ action, ...payload });
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The change could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          tone === "danger"
            ? "border-red-500/60 text-red-300 hover:bg-red-950"
            : "border-[#F5C542] text-[#F5C542] hover:bg-[#F5C542] hover:text-[#070D24]"
        }`}
      >
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-56 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
