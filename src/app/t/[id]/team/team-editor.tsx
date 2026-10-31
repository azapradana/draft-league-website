"use client";

import { useState } from "react";
import TeamView from "@/components/TeamView";
import type { TeamPokemon, TeamPokemonErrors } from "@/lib/team-types";

export default function TeamEditor({
  tournamentId,
  initialTeam,
  initialPaste,
  locked,
}: {
  tournamentId: string;
  initialTeam: TeamPokemon[] | null;
  initialPaste: string;
  locked: boolean;
}) {
  const [paste, setPaste] = useState(initialPaste);
  const [team, setTeam] = useState(initialTeam);
  const [saving, setSaving] = useState(false);
  const [general, setGeneral] = useState<string[]>([]);
  const [pokemonErrors, setPokemonErrors] = useState<TeamPokemonErrors[]>([]);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setSaving(true);
    setSaved(false);
    setGeneral([]);
    setPokemonErrors([]);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPaste: paste }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setTeam(data.team.pokemon);
        setSaved(true);
      } else if (response.status === 422) {
        setGeneral(data.general ?? []);
        setPokemonErrors(data.pokemon ?? []);
      } else {
        setGeneral([data.error ?? "Could not save your team."]);
      }
    } catch {
      setGeneral(["Network error. Please try again."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
        <h3 className="text-lg font-bold">Showdown team paste</h3>
        {locked ? (
          <p className="mt-2 rounded-lg border border-[#F5C542]/40 p-3 text-sm text-[#F5C542]">
            Teams are locked. You can no longer edit your team.
          </p>
        ) : null}
        <textarea
          aria-label="Pokémon Showdown team paste"
          className="mt-3 h-72 w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 font-mono text-sm text-[#EEF2FF] disabled:opacity-60"
          disabled={locked || saving}
          maxLength={20000}
          onChange={(event) => setPaste(event.target.value)}
          placeholder="Paste your Showdown export here (exactly 6 Pokémon)"
          value={paste}
        />
        <button
          className="mt-3 min-h-11 rounded-lg bg-[#F5C542] px-5 font-bold text-[#070D24] disabled:opacity-50"
          disabled={locked || saving || paste.trim() === ""}
          onClick={submit}
          type="button"
        >
          {saving ? "Validating…" : "Save team"}
        </button>
        {saved ? (
          <p className="mt-3 text-sm text-emerald-400" role="status">
            Team saved.
          </p>
        ) : null}
        {general.length > 0 || pokemonErrors.length > 0 ? (
          <div
            className="mt-4 space-y-3 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300"
            role="alert"
          >
            {general.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {pokemonErrors.map((entry) => (
              <div key={entry.index}>
                <p className="font-semibold">
                  Pokémon {entry.index + 1}: {entry.label}
                </p>
                <ul className="list-disc pl-5">
                  {entry.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
        <h3 className="mb-3 text-lg font-bold">Your saved team</h3>
        <TeamView team={team} />
      </section>
    </div>
  );
}
