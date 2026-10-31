"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { GroupActionResult } from "./actions";

type Props = {
  action: (formData: FormData) => Promise<GroupActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  closeOnSuccess?: boolean;
  confirmMessage?: string;
};

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  closeOnSuccess = false,
  confirmMessage,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    setError("");
    setLink("");
    try {
      const result = await action(new FormData(form));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Saved.");
      if (result.token && result.groupId) {
        setLink(`${window.location.origin}/register/rival/${result.groupId}?invite=${result.token}`);
      }
      if (resetOnSuccess) form.reset();
      if (closeOnSuccess) form.closest("dialog")?.close();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {error && <p role="alert" className="text-sm font-medium text-red-300">{error}</p>}
      {message && <p className="text-sm font-medium text-emerald-300">{message}</p>}
      {link && (
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Invitation link"
          className="w-full rounded-lg border border-[#F5C542] bg-[#070D24] px-3 py-2 text-xs text-[#EEF2FF]"
        />
      )}
    </form>
  );
}
