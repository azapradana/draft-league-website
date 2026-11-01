"use client";

import { useEffect, useRef, useState } from "react";

const buttonClass =
  "rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] transition hover:border-[#F5C542]";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export default function CopyOverlayLinks({ tournamentId }: { tournamentId: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy(kind: "score" | "matches") {
    const url = `${window.location.origin}/overlay/${encodeURIComponent(tournamentId)}/${kind}`;
    if (!(await copyText(url))) return;
    setCopied(kind);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={buttonClass} onClick={() => copy("score")}>
        Copy score bar link
      </button>
      <button type="button" className={buttonClass} onClick={() => copy("matches")}>
        Copy matches list link
      </button>
      <span role="status" aria-live="polite" className="text-sm font-semibold text-[#F5C542]">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
