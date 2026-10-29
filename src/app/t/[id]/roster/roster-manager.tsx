"use client";

import { useState } from "react";
import PokemonArtwork, { type PokemonArtworkSpecies } from "../pokemon-artwork";

export type CollectionSpecies = PokemonArtworkSpecies;

type CollectionEntry = CollectionSpecies & {
  quantity: number;
  sources: Array<{
    packName: string;
    tierName: string;
    tierColor: string;
    quantity: number;
    tierIsInferred: boolean;
  }>;
};

export default function RosterManager({
  tournamentId,
  collection,
  initialRoster,
  locked,
}: {
  tournamentId: string;
  collection: CollectionEntry[];
  initialRoster: number[];
  locked: boolean;
}) {
  const [selected, setSelected] = useState(initialRoster);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleSpecies(speciesDex: number) {
    setError("");
    setSaved(false);
    setSelected((current) =>
      current.includes(speciesDex)
        ? current.filter((dex) => dex !== speciesDex)
        : current.length < 6
          ? [...current, speciesDex]
          : current,
    );
  }

  async function saveRoster() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}/roster`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ speciesIds: selected }),
        },
      );
      const result = (await response.json()) as
        | { speciesIds: number[] }
        | { error: string };
      if (!response.ok || !("speciesIds" in result)) {
        throw new Error("error" in result ? result.error : "Your roster could not be saved.");
      }
      setSelected(result.speciesIds);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your roster could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Player collection
        </p>
        <h2 className="mt-2 text-3xl font-bold">Build your roster</h2>
        <p className="mt-3 max-w-2xl text-[#9FB0E6]">
          Select up to 6 distinct species from your collection. Your roster currently has{" "}
          <span className="font-semibold text-[#EEF2FF]">{selected.length}/6</span>.
        </p>
      </section>

      {locked && (
        <p
          role="status"
          className="rounded-xl border border-[#F5C542]/50 bg-[#F5C542]/10 p-4 font-semibold text-[#F5C542]"
        >
          Rosters are locked by the tournament admin. You can view your collection, but cannot
          change your roster.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/60 bg-red-950/40 p-4 text-red-200"
        >
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-emerald-300">
          Your roster has been saved.
        </p>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Your collection</h3>
            <p className="mt-1 text-sm text-[#9FB0E6]">
              {collection.length} distinct species · Select Pokémon to add or remove them.
            </p>
          </div>
          <button
            type="button"
            disabled={locked || saving}
            onClick={() => void saveRoster()}
            className="rounded-xl bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save roster"}
          </button>
        </div>

        {collection.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-[#243775] p-6 text-[#9FB0E6]">
            Your collection is empty. Open packs in the shop to collect Pokémon.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {collection.map(({ dex, name, isMega, imageUrl, quantity, sources }) => {
              const species = { dex, name, isMega, imageUrl };
              const isSelected = selected.includes(dex);
              const selectionBlocked = !isSelected && selected.length >= 6;
              return (
                <li key={dex}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={locked || selectionBlocked}
                    onClick={() => toggleSpecies(dex)}
                    className={`relative flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? "border-[#F5C542] bg-[#F5C542]/10"
                        : "border-[#243775] bg-[#0C1638] hover:border-[#9FB0E6]"
                    }`}
                  >
                    <span className="absolute right-3 top-3 rounded-full bg-[#070D24] px-2 py-1 text-xs font-bold text-[#F5C542]">
                      ×{quantity}
                    </span>
                    <PokemonArtwork species={species} className="h-24 w-24" />
                    <span className="mt-2 font-semibold">{name}</span>
                    <span className="mt-1 text-xs text-[#9FB0E6]">#{dex}</span>
                    {sources.length > 0 && (
                      <span className="mt-3 flex w-full flex-wrap justify-center gap-1.5">
                        {sources.map((source) => (
                          <span
                            key={`${source.packName}-${source.tierName}-${source.tierColor}`}
                            className="max-w-full rounded-full border px-2 py-1 text-xs"
                            style={{
                              borderColor: source.tierColor,
                              color: source.tierColor,
                            }}
                            title={`${source.packName} · ${source.tierName}${
                              source.tierIsInferred
                                ? " (inferred from current pack setup)"
                                : ""
                            } · ${source.quantity} ${
                              source.quantity === 1 ? "copy" : "copies"
                            }`}
                          >
                            {source.packName} · {source.tierName}
                            {source.tierIsInferred ? " · current" : ""}
                            {source.quantity > 1 ? ` ×${source.quantity}` : ""}
                          </span>
                        ))}
                      </span>
                    )}
                    {isSelected && (
                      <span className="mt-2 text-xs font-bold text-[#F5C542]">On your roster</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
