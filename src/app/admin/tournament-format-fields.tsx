"use client";

import { useState } from "react";

type TournamentFormat = "SINGLE_ELIMINATION" | "SWISS";

function recommendSwissRounds(participantCount: number): number | null {
  if (!Number.isSafeInteger(participantCount) || participantCount < 2) {
    return null;
  }

  const logarithmicRecommendation = Math.ceil(Math.log2(participantCount));
  return participantCount >= 8
    ? Math.max(4, logarithmicRecommendation)
    : logarithmicRecommendation;
}

export function TournamentFormatFields({
  initialFormat = "SINGLE_ELIMINATION",
  initialMaxParticipants = "",
  initialSwissRounds = 4,
}: {
  initialFormat?: TournamentFormat;
  initialMaxParticipants?: number | "";
  initialSwissRounds?: number;
}) {
  const [format, setFormat] = useState(initialFormat);
  const [maxParticipants, setMaxParticipants] = useState(
    initialMaxParticipants === "" ? "" : String(initialMaxParticipants),
  );
  const [swissRounds, setSwissRounds] = useState(String(initialSwissRounds));
  const participantCount = Number(maxParticipants);
  const recommendation =
    maxParticipants === "" ? null : recommendSwissRounds(participantCount);

  return (
    <>
      <label className="block">
        <span className="mb-2 block text-sm text-[#9FB0E6]">Tournament format</span>
        <select
          name="format"
          value={format}
          onChange={(event) => {
            if (
              event.target.value === "SINGLE_ELIMINATION" ||
              event.target.value === "SWISS"
            ) {
              setFormat(event.target.value);
            }
          }}
          className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
        >
          <option value="SINGLE_ELIMINATION">Single Elimination</option>
          <option value="SWISS">Swiss Rounds</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-[#9FB0E6]">Maximum participants</span>
        <input
          name="maxParticipants"
          type="number"
          min={2}
          max={2_147_483_647}
          step={1}
          value={maxParticipants}
          onChange={(event) => setMaxParticipants(event.target.value)}
          placeholder="No limit"
          className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
        />
        <span className="mt-1 block text-xs text-[#9FB0E6]">
          Leave blank for no participant limit.
        </span>
      </label>

      {format === "SWISS" && (
        <div className="rounded-lg border border-[#243775] bg-[#070D24]/60 p-4 md:col-span-2">
          <label className="block max-w-xs">
            <span className="mb-2 block text-sm text-[#9FB0E6]">Swiss rounds</span>
            <input
              name="swissRounds"
              type="number"
              min={1}
              max={20}
              step={1}
              required
              value={swissRounds}
              onChange={(event) => setSwissRounds(event.target.value)}
              className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
            />
          </label>
          <p className="mt-3 text-sm text-[#9FB0E6]" aria-live="polite">
            {recommendation === null
              ? "Set a maximum of at least 2 participants to see a round recommendation."
              : `Suggested: ${recommendation} ${
                  recommendation === 1 ? "round" : "rounds"
                } for ${participantCount} participants.`}
          </p>
          {recommendation !== null && (
            <button
              type="button"
              onClick={() => setSwissRounds(String(recommendation))}
              className="mt-2 text-sm font-semibold text-[#F5C542] underline underline-offset-2 hover:text-[#D9A21B]"
            >
              Use suggested rounds
            </button>
          )}
          <p className="mt-2 text-xs text-[#9FB0E6]">
            Recommendation: 4 rounds for 8-16 players, 5 for 17-32, 6 for 33-64;
            otherwise rounded up from log2 of the participant count.
          </p>
        </div>
      )}
    </>
  );
}
