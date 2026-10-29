"use client";

import { useEffect, useMemo, useState } from "react";

export type PackEditorTier = {
  id?: string;
  name: string;
  weight: string;
  color: string;
  minimumOne: boolean;
};

type PackEditorSpecies = {
  dex: number;
  name: string;
};

type PackEditorEntry = {
  speciesDex: number;
  tierId: string;
};

type PackEditorsProps = {
  packId: string;
  initialTiers: PackEditorTier[];
  initialEntries: PackEditorEntry[];
  species: PackEditorSpecies[];
};

async function postAdminAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { error?: string; tiers?: PackEditorTier[] };
  if (!response.ok) {
    throw new Error(result.error ?? "The save failed. Please try again.");
  }
  return result;
}

export function PackEditors({
  packId,
  initialTiers,
  initialEntries,
  species,
}: PackEditorsProps) {
  const [tiers, setTiers] = useState(initialTiers);
  const [entries, setEntries] = useState(initialEntries);

  return (
    <div className="mt-8 space-y-8">
      <TierEditor
        packId={packId}
        tiers={tiers}
        populatedTierIds={new Set(entries.map((entry) => entry.tierId))}
        onSaved={setTiers}
      />
      <PoolEditor
        packId={packId}
        tiers={tiers}
        initialEntries={entries}
        species={species}
        onSaved={setEntries}
      />
    </div>
  );
}

function TierEditor({
  packId,
  tiers,
  populatedTierIds,
  onSaved,
}: {
  packId: string;
  tiers: PackEditorTier[];
  populatedTierIds: Set<string>;
  onSaved: (tiers: PackEditorTier[]) => void;
}) {
  const [draft, setDraft] = useState(() =>
    tiers.map((tier) => ({ ...tier, minimumOne: tier.minimumOne === true })),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const totalWeight = useMemo(
    () => draft.reduce((total, tier) => total + (Number(tier.weight) || 0), 0),
    [draft],
  );

  function updateTier(index: number, patch: Partial<PackEditorTier>) {
    setDraft((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, ...patch } : tier,
      ),
    );
    setSaved("");
  }

  async function saveTiers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const result = await postAdminAction({ action: "saveTiers", packId, tiers: draft });
      if (!result.tiers) {
        throw new Error("The server did not return the saved tiers.");
      }
      const savedTiers = result.tiers.map((tier) => ({
        ...tier,
        minimumOne: tier.minimumOne === true,
      }));
      setDraft(savedTiers);
      onSaved(savedTiers);
      setSaved("Tiers saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The tiers could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Rarity tiers</h2>
          <p className="mt-1 text-sm text-[#9FB0E6]">
            Weight shares apply to regular pulls. Guaranteed tiers reserve one pull each in every pack.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setDraft((current) => [
              ...current,
              { name: "", weight: "1", color: "#9FB0E6", minimumOne: false },
            ])
          }
          className="rounded-lg border border-[#243775] px-4 py-2 font-semibold text-[#EEF2FF] hover:border-[#F5C542]"
        >
          Add tier
        </button>
      </div>

      <form onSubmit={saveTiers} className="mt-5 space-y-3">
        {draft.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#243775] p-4 text-sm text-[#9FB0E6]">
            Add at least one tier before assigning Pokémon to this pack.
          </p>
        ) : (
          draft.map((tier, index) => {
            const share = totalWeight > 0 ? ((Number(tier.weight) || 0) / totalWeight) * 100 : 0;
            const populated = Boolean(tier.id && populatedTierIds.has(tier.id));
            return (
              <div
                key={tier.id ?? `new-tier-${index}`}
                className="grid gap-3 rounded-xl border border-[#243775] bg-[#070D24] p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(7rem,0.7fr)_minmax(8rem,0.7fr)_auto_auto_auto]"
              >
                <label className="block">
                  <span className="mb-2 block text-sm text-[#9FB0E6]">Tier name</span>
                  <input
                    value={tier.name}
                    maxLength={40}
                    required
                    onChange={(event) => updateTier(index, { name: event.target.value })}
                    className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-[#9FB0E6]">Weight</span>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={tier.weight}
                    required
                    onChange={(event) => updateTier(index, { weight: event.target.value })}
                    className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-[#9FB0E6]">Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(tier.color) ? tier.color : "#9FB0E6"}
                      onChange={(event) => updateTier(index, { color: event.target.value })}
                      aria-label={`${tier.name || "Tier"} color`}
                      className="h-12 w-14 cursor-pointer rounded border border-[#243775] bg-[#0C1638] p-1"
                    />
                    <span className="text-sm text-[#9FB0E6]">{tier.color}</span>
                  </div>
                </label>
                <div className="self-end pb-3 text-sm text-[#9FB0E6]">
                  {share.toFixed(2)}%
                </div>
                <label className="flex items-center gap-2 self-end pb-3 text-sm text-[#9FB0E6]">
                  <input
                    type="checkbox"
                    checked={tier.minimumOne === true}
                    onChange={(event) => updateTier(index, { minimumOne: event.target.checked })}
                    className="h-4 w-4 accent-[#F5C542]"
                    aria-label={`Guarantee at least one ${tier.name || "unnamed"} Pokémon per pack`}
                  />
                  <span className="whitespace-nowrap">At least one per pack</span>
                </label>
                <div className="self-end">
                  <button
                    type="button"
                    disabled={populated}
                    onClick={() =>
                      setDraft((current) => current.filter((_, tierIndex) => tierIndex !== index))
                    }
                    className="rounded-lg border border-red-500/60 px-3 py-2 font-semibold text-red-300 enabled:hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
                    title={populated ? "Move the Pokémon out of this tier before deleting it." : undefined}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {saved && <p role="status" className="text-sm text-emerald-300">{saved}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving tiers…" : "Save tiers"}
        </button>
      </form>
    </section>
  );
}

function PoolEditor({
  packId,
  tiers,
  initialEntries,
  species,
  onSaved,
}: {
  packId: string;
  tiers: PackEditorTier[];
  initialEntries: PackEditorEntry[];
  species: PackEditorSpecies[];
  onSaved: (entries: PackEditorEntry[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.speciesDex, entry.tierId])),
  );
  const [bulkTierId, setBulkTierId] = useState(tiers[0]?.id ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tiers.some((tier) => tier.id === bulkTierId)) {
      setBulkTierId(tiers.find((tier) => tier.id)?.id ?? "");
    }
  }, [bulkTierId, tiers]);

  const shownSpecies = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return species;
    return species.filter(
      (pokemon) =>
        pokemon.name.toLocaleLowerCase().includes(normalizedSearch) ||
        String(pokemon.dex).includes(normalizedSearch),
    );
  }, [search, species]);

  function addAllShown() {
    if (!bulkTierId) return;
    setSelected((current) => {
      const next = { ...current };
      for (const pokemon of shownSpecies) {
        next[pokemon.dex] = bulkTierId;
      }
      return next;
    });
    setSaved("");
  }

  function removeAllShown() {
    setSelected((current) => {
      const next = { ...current };
      for (const pokemon of shownSpecies) {
        delete next[pokemon.dex];
      }
      return next;
    });
    setSaved("");
  }

  async function savePool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const entries = Object.entries(selected).map(([speciesDex, tierId]) => ({
        speciesDex: Number(speciesDex),
        tierId,
      }));
      await postAdminAction({
        action: "savePool",
        packId,
        entries,
      });
      onSaved(entries);
      setSaved(`Pool saved with ${Object.keys(selected).length} Pokémon.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The pool could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
      <div>
        <h2 className="text-xl font-semibold">Pokémon pool</h2>
        <p className="mt-1 text-sm text-[#9FB0E6]">
          Choose which seeded species can appear, then assign each one to a tier.
          {` ${species.length} species available.`}
        </p>
      </div>

      {tiers.length === 0 ? (
        <p className="mt-5 rounded-lg border border-[#243775] bg-[#070D24] p-4 text-sm text-[#9FB0E6]">
          Save at least one rarity tier before editing the pool.
        </p>
      ) : (
        <form onSubmit={savePool} className="mt-5">
          <label className="block max-w-xl">
            <span className="mb-2 block text-sm text-[#9FB0E6]">Search species by name or National Dex number</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="For example, Gengar or 94"
              className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#9FB0E6]">
              <span>Tier for shown species</span>
              <select
                value={bulkTierId}
                onChange={(event) => setBulkTierId(event.target.value)}
                className="rounded-lg border border-[#243775] bg-[#070D24] p-2 text-[#EEF2FF]"
              >
                {tiers.map((tier) => (
                  <option key={tier.id ?? tier.name} value={tier.id ?? ""}>{tier.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addAllShown}
              className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] hover:border-[#F5C542]"
            >
              Add all shown
            </button>
            <button
              type="button"
              onClick={removeAllShown}
              className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-semibold text-[#EEF2FF] hover:border-red-400"
            >
              Remove all shown
            </button>
            <span className="text-sm text-[#9FB0E6]">
              {Object.keys(selected).length} included
            </span>
          </div>

          <ul className="mt-4 max-h-[34rem] divide-y divide-[#243775] overflow-y-auto rounded-xl border border-[#243775] bg-[#070D24]">
            {shownSpecies.length === 0 ? (
              <li className="p-4 text-sm text-[#9FB0E6]">No species match this search.</li>
            ) : (
              shownSpecies.map((pokemon) => {
                const tierId = selected[pokemon.dex];
                return (
                  <li
                    key={pokemon.dex}
                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={tierId !== undefined}
                        onChange={(event) => {
                          setSelected((current) => {
                            const next = { ...current };
                            if (event.target.checked) {
                              next[pokemon.dex] = bulkTierId || tiers[0].id || "";
                            } else {
                              delete next[pokemon.dex];
                            }
                            return next;
                          });
                          setSaved("");
                        }}
                        className="h-4 w-4 accent-[#F5C542]"
                      />
                      <span className="truncate">
                        <span className="font-semibold">{pokemon.name}</span>
                        <span className="ml-2 text-sm text-[#9FB0E6]">#{pokemon.dex}</span>
                      </span>
                    </label>
                    {tierId !== undefined && (
                      <select
                        aria-label={`Tier for ${pokemon.name}`}
                        value={tierId}
                        onChange={(event) => {
                          setSelected((current) => ({
                            ...current,
                            [pokemon.dex]: event.target.value,
                          }));
                          setSaved("");
                        }}
                        className="rounded-lg border border-[#243775] bg-[#0C1638] p-2 text-[#EEF2FF]"
                      >
                        {tiers.map((tier) => (
                          <option key={tier.id ?? tier.name} value={tier.id ?? ""}>{tier.name}</option>
                        ))}
                      </select>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
          {saved && <p role="status" className="mt-4 text-sm text-emerald-300">{saved}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving pool…" : "Save pool"}
          </button>
        </form>
      )}
    </section>
  );
}
