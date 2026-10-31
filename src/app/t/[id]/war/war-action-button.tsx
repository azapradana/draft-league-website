"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WarActionResult } from "./actions";

type Props = {
  action: () => Promise<WarActionResult>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
};

export function WarActionButton({ action, label, pendingLabel, variant = "primary" }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onClick() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if ("error" in result) setError(result.error);
      else setMessage(result.message ?? "");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const style =
    variant === "primary"
      ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
      : "border border-slate-600 text-white hover:bg-slate-800";

  return (
    <div className="space-y-2">
      <button
        className={`min-h-11 rounded-md px-5 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${style}`}
        disabled={pending}
        onClick={onClick}
        type="button"
      >
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
      {message && <p className="text-sm text-emerald-300">{message}</p>}
    </div>
  );
}
