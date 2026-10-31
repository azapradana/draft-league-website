"use client";

import { useState } from "react";
import GroupBadge, { type GroupInfo } from "@/components/GroupBadge";
import PokemonArtwork, {
  type PokemonArtworkSpecies,
} from "@/app/t/[id]/pokemon-artwork";

export type MatchPlayer = {
  id: string;
  isCurrentUser: boolean;
  name: string;
  group?: GroupInfo;
  roster: Array<
    PokemonArtworkSpecies & {
      types: string[];
      tiers: Array<{ name: string; color: string | null }>;
    }
  >;
} | null;

export type RosterTab = { key: string; label: string; player: MatchPlayer };

export default function MatchRosterInspector({ tabs }: { tabs: RosterTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  if (!active) {
    return null;
  }
  const { player } = active;

  return (
    <section className="rounded-xl border border-[#243775] bg-[#0C1638] p-3 sm:p-4">
      <div role="tablist" aria-label="Roster inspector" className="grid grid-cols-2 gap-1 rounded-lg bg-[#070D24] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`roster-tab-${tab.key}`}
            aria-selected={tab.key === active.key}
            aria-controls="roster-panel"
            onClick={() => setActiveKey(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542] ${
              tab.key === active.key
                ? "bg-[#F5C542] text-[#070D24]"
                : "text-[#9FB0E6] hover:text-[#EEF2FF]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="roster-panel" role="tabpanel" aria-labelledby={`roster-tab-${active.key}`} className="mt-3">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {player?.name ?? "Bye"}
          <GroupBadge group={player?.group} />
        </h3>
        {!player ? (
          <p className="mt-2 text-sm text-[#9FB0E6]">
            This bracket slot is a bye; no roster is available.
          </p>
        ) : player.roster.length === 0 ? (
          <p className="mt-2 text-sm text-[#9FB0E6]">No roster has been selected.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {player.roster.slice(0, 6).map((pokemon) => (
              <li
                key={pokemon.dex}
                className="flex min-w-0 flex-col items-center rounded-lg border border-[#243775] bg-[#070D24] p-2 text-center"
              >
                <PokemonArtwork species={pokemon} className="h-16 w-16" />
                <span className="mt-1 break-words text-sm font-semibold">{pokemon.name}</span>
                <span className="text-xs text-[#9FB0E6]">#{pokemon.dex}</span>
                <span className="mt-1 flex flex-wrap justify-center gap-1">
                  {pokemon.types.length > 0 ? (
                    pokemon.types.map((type) => (
                      <span
                        key={type}
                        className="rounded-full bg-[#243775] px-2 py-0.5 text-[0.65rem] font-semibold text-[#EEF2FF]"
                      >
                        {type}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#9FB0E6]">Type not recorded</span>
                  )}
                </span>
                <span className="mt-1 flex flex-wrap justify-center gap-1">
                  {pokemon.tiers.length > 0 ? (
                    pokemon.tiers.map((tier) => (
                      <span
                        key={`${tier.name}-${tier.color ?? ""}`}
                        className="rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold"
                        style={{
                          borderColor: tier.color ?? "#9FB0E6",
                          color: tier.color ?? "#9FB0E6",
                        }}
                      >
                        {tier.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#9FB0E6]">Tier not recorded</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
