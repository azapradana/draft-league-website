"use client";

import { useEffect, useRef, useState } from "react";
import type { OverlayData } from "@/lib/overlay";

const OVERLAY_DEFAULT_ACCENT = "#F5C542";
const POLL_MS = 5000;
const bodyFont = { fontFamily: 'Figtree, "Bricolage Grotesque", sans-serif' };

// Keeps the last good data on screen when a poll fails.
function useOverlayData(tournamentId: string, initial: OverlayData) {
  const [data, setData] = useState(initial);
  const lastJson = useRef(JSON.stringify(initial));

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/overlay/${encodeURIComponent(tournamentId)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = (await response.json()) as OverlayData;
        const json = JSON.stringify(next);
        if (!stopped && json !== lastJson.current) {
          lastJson.current = json;
          setData(next);
        }
      } catch {
        // Keep showing the previous data.
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [tournamentId]);

  return data;
}

type Group = OverlayData["groups"][number];
const accentOf = (group: Group | undefined) => group?.accentColor ?? OVERLAY_DEFAULT_ACCENT;

function Logo({ group, size }: { group: Group; size: string }) {
  return group.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={group.logoUrl}
      alt=""
      className={`${size} shrink-0 rounded-lg object-cover`}
      style={{ boxShadow: `0 0 0 2px ${accentOf(group)}` }}
    />
  ) : (
    <div
      aria-hidden
      className={`${size} display-font flex shrink-0 items-center justify-center rounded-lg bg-[#101C45] text-lg font-bold text-[#EEF2FF]`}
      style={{ boxShadow: `0 0 0 2px ${accentOf(group)}` }}
    >
      {group.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Score({ value }: { value: number }) {
  // Re-keying on change replays the pop animation (disabled for reduced motion in CSS).
  return (
    <span key={value} className="overlay-pop display-font text-5xl font-extrabold tabular-nums">
      {value}
    </span>
  );
}

export function ScoreBarOverlay({
  tournamentId,
  initial,
}: {
  tournamentId: string;
  initial: OverlayData;
}) {
  const data = useOverlayData(tournamentId, initial);
  const [left, right] = data.groups;
  if (!left || !right) return null;

  const total = left.score + right.score;
  const leftShare = total === 0 ? 50 : (left.score / total) * 100;

  const side = (group: Group, align: "left" | "right") => (
    <div
      className={`flex min-w-0 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <Logo group={group} size="size-14" />
      <div className="min-w-0">
        <p className="display-font truncate text-xl font-bold text-[#EEF2FF]">
          {group.isWinner && <span aria-hidden="true">🏆 </span>}
          {group.name}
        </p>
      </div>
      <div className="px-2 text-[#EEF2FF]" style={{ textShadow: `0 0 18px ${accentOf(group)}66` }}>
        <Score value={group.score} />
      </div>
    </div>
  );

  return (
    <main
      style={bodyFont}
      className="w-full max-w-[960px] rounded-2xl border border-[#243775] bg-[#070D24]/95 p-4 text-[#EEF2FF] shadow-xl"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {side(left, "left")}
        <span className="display-font text-sm font-black tracking-[0.2em] text-[#F5C542]">VS</span>
        {side(right, "right")}
      </div>
      <div
        className="mt-3 flex h-3 w-full gap-1 overflow-hidden rounded-full bg-[#0C1638]"
        role="img"
        aria-label={`${left.name} ${left.score}, ${right.name} ${right.score}`}
      >
        <div
          className="overlay-bar h-full rounded-full"
          style={{ width: `${leftShare}%`, backgroundColor: accentOf(left) }}
        />
        <div
          className="overlay-bar h-full flex-1 rounded-full"
          style={{ backgroundColor: accentOf(right) }}
        />
      </div>
    </main>
  );
}

const RESULT_LABEL = { win: "Win", loss: "Loss", draw: "Draw", in_progress: "In progress" } as const;

export function MatchesOverlay({
  tournamentId,
  initial,
}: {
  tournamentId: string;
  initial: OverlayData;
}) {
  const data = useOverlayData(tournamentId, initial);
  if (data.matches.length === 0) return null;

  return (
    <main
      style={bodyFont}
      className="w-full max-w-[720px] space-y-2 rounded-2xl border border-[#243775] bg-[#070D24]/95 p-3 text-[#EEF2FF] shadow-xl"
    >
      {data.matches.map((match, index) => {
        const accent1 = accentOf(data.groups[match.player1.group]);
        const accent2 = accentOf(data.groups[match.player2.group]);
        const won1 = match.result === "win";
        const won2 = match.result === "loss";
        return (
          <div
            key={index}
            className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 rounded-xl border border-[#243775] bg-[#0C1638] px-3 py-2"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#9FB0E6]">
              R{match.round}
            </span>
            <span
              className={`display-font truncate border-l-4 pl-3 text-lg ${
                won2 ? "font-medium text-[#9FB0E6]" : "font-bold"
              }`}
              style={{ borderColor: accent1 }}
            >
              {match.player1.name}
            </span>
            <span
              className={`overlay-fade min-w-[5.5rem] rounded-full px-3 py-1 text-center text-xs font-bold uppercase tracking-wide ${
                match.result === "in_progress"
                  ? "bg-[#101C45] text-[#9FB0E6]"
                  : "bg-[#F5C542] text-[#070D24]"
              }`}
              key={match.result}
              aria-label={
                won1
                  ? `${match.player1.name} wins`
                  : won2
                    ? `${match.player2.name} wins`
                    : RESULT_LABEL[match.result]
              }
            >
              {won1 ? "◀ Win" : won2 ? "Win ▶" : RESULT_LABEL[match.result]}
            </span>
            <span
              className={`display-font truncate border-r-4 pr-3 text-right text-lg ${
                won1 ? "font-medium text-[#9FB0E6]" : "font-bold"
              }`}
              style={{ borderColor: accent2 }}
            >
              {match.player2.name}
            </span>
          </div>
        );
      })}
    </main>
  );
}
