"use client";

import Link from "next/link";
import { useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { RivalInviteLinkBox } from "@/components/RivalInviteLinkBox";
import { createFriendlyMatch, type CreateFriendlyMatchResult } from "./actions";

const PRESETS = [3, 5, 7];
const inputClass =
  "w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]";

export function CreateFriendlyForm({ coreGroupName }: { coreGroupName: string }) {
  const [squadSize, setSquadSize] = useState("5");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<
    Extract<CreateFriendlyMatchResult, { success: true }> | null
  >(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    setPending(true);
    setError("");
    try {
      const result = await createFriendlyMatch(new FormData(event.currentTarget));
      if ("error" in result) setError(result.error);
      else setCreated(result);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-5">
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          Friendly match created: {coreGroupName} vs {created.rivalGroupName}.
        </p>
        <RivalInviteLinkBox invitePath={created.invitePath} groupName={created.rivalGroupName} />
        <div className="flex gap-3">
          <Link
            href={`/admin/t/${created.tournamentId}`}
            className="rounded-lg bg-[#F5C542] px-4 py-3 text-sm font-bold text-[#070D24]"
          >
            Open tournament
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-[#243775] px-4 py-3 text-sm font-semibold text-[#9FB0E6]"
          >
            Back to admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" aria-busy={pending}>
      <label className="block">
        <span className="mb-2 block text-sm text-[#9FB0E6]">Tournament name</span>
        <input name="name" required minLength={2} maxLength={100} placeholder="7DS vs Rivals" className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm text-[#9FB0E6]">Description</span>
        <textarea name="description" rows={4} maxLength={5000} className={inputClass} />
      </label>

      <fieldset className="rounded-xl border border-[#243775] p-4">
        <legend className="px-2 text-sm font-semibold text-[#F5C542]">Squad size (N vs N)</legend>
        <div className="flex flex-wrap items-center gap-3">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSquadSize(String(n))}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                squadSize === String(n)
                  ? "border-[#F5C542] bg-[#F5C542] text-[#070D24]"
                  : "border-[#243775] text-[#9FB0E6]"
              }`}
            >
              {n}v{n}
            </button>
          ))}
          <input
            name="squadSize"
            type="number"
            min={1}
            max={50}
            required
            value={squadSize}
            onChange={(event) => setSquadSize(event.target.value)}
            aria-label="Squad size"
            className="w-28 rounded-lg border border-[#243775] bg-[#070D24] p-2 text-[#EEF2FF]"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-[#243775] p-4">
        <legend className="px-2 text-sm font-semibold text-[#F5C542]">Groups</legend>
        <p className="text-sm text-[#9FB0E6]">
          Home group: <strong className="text-[#EEF2FF]">{coreGroupName}</strong> (fixed)
        </p>
        <label className="block">
          <span className="mb-2 block text-sm text-[#9FB0E6]">Rival group name</span>
          <input name="rivalName" required minLength={2} maxLength={50} className={inputClass} />
        </label>
        <ImageUpload name="rivalLogoUpload" label="Rival group logo (upload)" onUploadingChange={setUploading} />
        <label className="block">
          <span className="mb-2 block text-sm text-[#9FB0E6]">…or logo URL</span>
          <input name="rivalLogoUrl" type="url" placeholder="https://" className={inputClass} />
        </label>
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={pending || uploading}
        className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create friendly match"}
      </button>
    </form>
  );
}
