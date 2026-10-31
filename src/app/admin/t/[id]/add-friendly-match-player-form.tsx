"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AddFriendlyMatchPlayerForm({
  tournamentId,
  groups,
}: {
  tournamentId: string;
  groups: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/participants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, groupId }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to assign this player.");
        return;
      }
      setUsername("");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="sr-only" htmlFor="friendly-match-player-username">Player username</label>
      <input
        id="friendly-match-player-username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        required
        placeholder="Player username"
        className="rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
      />
      <label className="sr-only" htmlFor="friendly-match-player-group">Player group</label>
      <select
        id="friendly-match-player-group"
        value={groupId}
        onChange={(event) => setGroupId(event.target.value)}
        required
        className="rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>{group.name}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || groups.length !== 2}
        className="rounded-lg bg-[#F5C542] px-4 py-3 font-bold text-[#070D24] disabled:opacity-60"
      >
        {pending ? "Assigning…" : "Add to lineup"}
      </button>
      {error && <p className="text-sm text-red-300 sm:col-span-3" role="alert">{error}</p>}
    </form>
  );
}
