"use client";

import { useState, useTransition } from "react";
import {
  assignToMatch,
  clearMatchSlot,
  declareWarMatchDraw,
  forceAssignToWar,
  removeFromWar,
  startWarPairings,
  type WarAdminResult,
} from "./war-actions";

type Person = { userId: string; name: string; groupName: string };
type WarMatch = {
  id: string;
  status: string;
  player1: Person | null;
  player2: Person | null;
  winnerName: string | null;
};

export default function WarAdminPanel({
  tournamentId,
  warStatus,
  pairingsSeeded,
  matches,
  roster,
  candidates,
}: {
  tournamentId: string;
  warStatus: string;
  pairingsSeeded: boolean;
  matches: WarMatch[];
  roster: Person[];
  candidates: Person[];
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<WarAdminResult | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const locked = warStatus === "COMPLETED" || warStatus === "CANCELLED";

  const submit = (action: () => Promise<WarAdminResult>) =>
    startTransition(async () => setFeedback(await action()));
  const everyone = [...roster, ...candidates];
  const select =
    "rounded-lg border border-[#243775] bg-[#070D24] px-2 py-1 text-sm text-[#EEF2FF]";
  const button =
    "rounded-lg border border-[#F5C542] px-3 py-1 text-sm font-semibold text-[#F5C542] disabled:opacity-50";

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
      <div>
        <h2 className="text-xl font-bold">Friendly match war</h2>
        <p className="text-sm text-[#9FB0E6]">Status: {warStatus.replace(/_/g, " ")}</p>
      </div>

      {feedback && (
        <p
          role="status"
          className={`text-sm ${"error" in feedback ? "text-red-300" : "text-emerald-300"}`}
        >
          {"error" in feedback ? feedback.error : feedback.message}
        </p>
      )}

      {warStatus === "IN_PROGRESS" && !pairingsSeeded && (
        <div className="space-y-2">
          <p className="text-sm text-[#9FB0E6]">
            Randomly pairs active 7DS players against rival players. This can only be done once.
          </p>
          <button
            className={button}
            disabled={pending}
            onClick={() => {
              if (window.confirm("Generate the one-time random pairings?")) {
                submit(() => startWarPairings(tournamentId));
              }
            }}
            type="button"
          >
            Generate pairings
          </button>
        </div>
      )}
      {warStatus === "OPEN" && (
        <p className="text-sm text-[#9FB0E6]">
          Finalize the 7DS roster from the war page before generating pairings.
        </p>
      )}

      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm" htmlFor="war-add-user">
            Force-add to roster
          </label>
          <select
            className={select}
            id="war-add-user"
            onChange={(e) => setAddUserId(e.target.value)}
            value={addUserId}
          >
            <option value="">Select a user…</option>
            {candidates.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name} ({p.groupName})
              </option>
            ))}
          </select>
          <button
            className={button}
            disabled={pending || !addUserId}
            onClick={() => {
              submit(() => forceAssignToWar(tournamentId, addUserId));
              setAddUserId("");
            }}
            type="button"
          >
            Add
          </button>
        </div>
      )}

      {matches.length > 0 && (
        <ul className="space-y-3">
          {matches.map((match, index) => (
            <li className="rounded-xl border border-[#243775] p-3" key={match.id}>
              <p className="mb-2 text-xs uppercase tracking-wider text-[#9FB0E6]">
                Pairing {index + 1} · {match.status}
                {match.status === "COMPLETED" &&
                  ` · ${match.winnerName ? `Winner: ${match.winnerName}` : "Draw"}`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["player1", "player2"] as const).map((slot) => {
                  const person = match[slot];
                  return (
                    <div className="space-y-1" key={slot}>
                      <p className="text-sm font-semibold">
                        {person ? `${person.name} (${person.groupName})` : "Empty slot"}
                      </p>
                      {match.status !== "COMPLETED" && !locked && (
                        <div className="flex flex-wrap gap-2">
                          <select
                            aria-label={`Assign ${slot} of pairing ${index + 1}`}
                            className={select}
                            disabled={pending}
                            onChange={(e) => {
                              const userId = e.target.value;
                              if (userId) {
                                submit(() => assignToMatch(tournamentId, match.id, slot, userId));
                              }
                              e.target.value = "";
                            }}
                            defaultValue=""
                          >
                            <option value="">Reassign…</option>
                            {everyone.map((p) => (
                              <option key={p.userId} value={p.userId}>
                                {p.name} ({p.groupName})
                              </option>
                            ))}
                          </select>
                          {person && (
                            <button
                              className="text-sm text-red-300 hover:underline disabled:opacity-50"
                              disabled={pending}
                              onClick={() => submit(() => clearMatchSlot(tournamentId, match.id, slot))}
                              type="button"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {match.status !== "COMPLETED" && !locked && match.player1 && match.player2 && (
                <button
                  className="mt-3 text-sm text-[#9FB0E6] hover:underline disabled:opacity-50"
                  disabled={pending}
                  onClick={() => submit(() => declareWarMatchDraw(tournamentId, match.id))}
                  type="button"
                >
                  Declare draw
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {roster.length > 0 && !locked && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">War roster</h3>
          <ul className="divide-y divide-[#243775] text-sm">
            {roster.map((p) => (
              <li className="flex items-center justify-between py-1" key={p.userId}>
                <span>
                  {p.name} <span className="text-[#9FB0E6]">({p.groupName})</span>
                </span>
                <button
                  className="text-red-300 hover:underline disabled:opacity-50"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${p.name} from the war?`)) {
                      submit(() => removeFromWar(tournamentId, p.userId));
                    }
                  }}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
