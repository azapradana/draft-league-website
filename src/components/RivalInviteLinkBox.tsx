"use client";

import { useState } from "react";

type Props = {
  invitePath: string;
  groupName?: string;
};

export function RivalInviteLinkBox({ invitePath, groupName }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const link =
    typeof window === "undefined" ? invitePath : `${window.location.origin}${invitePath}`;

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  }

  return (
    <div className="rounded-xl border border-[#F5C542]/40 bg-[#0B1330] p-4">
      <p className="text-sm font-semibold text-[#F5C542]">
        Rival invitation link{groupName ? ` for ${groupName}` : ""}
      </p>
      <p className="mt-1 text-xs text-[#9FB0E6]">
        Share this link with the opposing group. Members who register through it join their group automatically.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          aria-label="Rival invitation link"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-[#243775] bg-[#070D24] p-3 text-sm text-[#EEF2FF]"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-[#F5C542] px-4 py-3 text-sm font-bold text-[#070D24] hover:brightness-110"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
