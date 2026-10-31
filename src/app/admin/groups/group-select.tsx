"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignUserToGroup } from "./actions";

type Props = {
  userId: string;
  value: string | null;
  groups: { id: string; name: string }[];
};

export function GroupSelect({ userId, value, groups }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(value ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const previous = current;
    setCurrent(next);
    setError("");
    setSaved(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("groupId", next);
      try {
        const result = await assignUserToGroup(formData);
        if ("error" in result) {
          setCurrent(previous);
          setError(result.error);
          return;
        }
        setSaved(true);
        router.refresh();
      } catch {
        setCurrent(previous);
        setError("Could not save.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Group"
        className="w-44 rounded-lg border border-[#243775] bg-[#070D24] px-2 py-1.5 text-sm text-[#EEF2FF] outline-none focus:border-[#F5C542] disabled:opacity-50"
      >
        <option value="">No group</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>{group.name}</option>
        ))}
      </select>
      <span aria-live="polite" className="w-16 text-xs">
        {pending && <span className="text-[#9FB0E6]">Saving…</span>}
        {!pending && saved && <span className="text-emerald-300">Saved</span>}
        {error && <span role="alert" className="text-red-300">{error}</span>}
      </span>
    </div>
  );
}
