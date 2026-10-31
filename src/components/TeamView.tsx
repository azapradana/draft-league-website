import type { PublicTeamPokemon, TeamPokemon } from "@/lib/team-types";

type AnyPokemon = PublicTeamPokemon & Partial<Pick<TeamPokemon, "evs" | "ivs" | "level">>;

const STAT_LABELS: Array<[string, string]> = [
  ["hp", "HP"],
  ["atk", "Atk"],
  ["def", "Def"],
  ["spa", "SpA"],
  ["spd", "SpD"],
  ["spe", "Spe"],
];

function formatEvs(evs: Record<string, number> | undefined): string {
  if (!evs) return "";
  return STAT_LABELS.filter(([key]) => (evs[key] ?? 0) > 0)
    .map(([key, label]) => `${evs[key]} ${label}`)
    .join(" / ");
}

export default function TeamView({
  team,
  emptyMessage = "No team submitted yet",
}: {
  team: AnyPokemon[] | null | undefined;
  emptyMessage?: string;
}) {
  if (!team || team.length === 0) {
    return <p className="text-sm text-[#9FB0E6]">{emptyMessage}</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {team.map((pokemon, index) => {
        const evs = formatEvs(pokemon.evs);
        return (
          <li
            key={`${pokemon.species}-${index}`}
            className="rounded-xl border border-[#243775] bg-[#070D24] p-3 text-sm"
          >
            <p className="font-bold text-[#EEF2FF]">
              {pokemon.species}
              {pokemon.item ? (
                <span className="font-normal text-[#9FB0E6]"> @ {pokemon.item}</span>
              ) : null}
            </p>
            <p className="mt-1 text-[#9FB0E6]">
              {pokemon.ability || "No ability"} · {pokemon.nature || "Hardy"}
            </p>
            <ul className="mt-2 list-disc pl-5 text-[#EEF2FF]">
              {pokemon.moves.map((move) => (
                <li key={move}>{move}</li>
              ))}
            </ul>
            {pokemon.evs ? (
              <p className="mt-2 text-xs text-[#F5C542]">EVs: {evs || "none"}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
