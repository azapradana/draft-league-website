import type { PublicTeamPokemon, TeamPokemon } from "@/lib/team-types";
import PokemonArtwork, {
  type TeamArtworkBySpecies,
} from "@/app/t/[id]/pokemon-artwork";

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
  artworkBySpecies,
  emptyMessage = "No team submitted yet",
  horizontal = false,
}: {
  team: AnyPokemon[] | null | undefined;
  artworkBySpecies: TeamArtworkBySpecies;
  emptyMessage?: string;
  horizontal?: boolean;
}) {
  if (!team || team.length === 0) {
    return <p className="text-sm text-[#9FB0E6]">{emptyMessage}</p>;
  }

  return (
    <ul
      className={
        horizontal
          ? "grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"
          : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {team.map((pokemon, index) => {
        const evs = formatEvs(pokemon.evs);
        return (
          <li
            key={`${pokemon.species}-${index}`}
            className={
              horizontal
                ? "flex flex-col items-center gap-2 rounded-xl border border-[#243775] bg-[#070D24] p-2 text-xs"
                : "flex items-start gap-3 rounded-xl border border-[#243775] bg-[#070D24] p-3 text-sm"
            }
          >
            <PokemonArtwork
              species={artworkBySpecies[pokemon.species] ?? {
                dex: 0,
                name: pokemon.species,
                isMega: true,
                imageUrl: null,
              }}
              className={horizontal ? "h-16 w-16" : "h-16 w-16 sm:h-20 sm:w-20"}
            />
            <div className={horizontal ? "w-full min-w-0 text-center" : "min-w-0 flex-1"}>
              <p className="break-words font-bold text-[#EEF2FF]">
                {pokemon.species}
                {pokemon.item ? (
                  <span className="font-normal text-[#9FB0E6]"> @ {pokemon.item}</span>
                ) : null}
              </p>
              <p className="mt-1 text-[#9FB0E6]">
                {pokemon.ability || "No ability"} · {pokemon.nature || "Hardy"}
              </p>
              <ul
                className={
                  horizontal
                    ? "mt-2 space-y-0.5 text-[#EEF2FF]"
                    : "mt-2 list-disc pl-5 text-[#EEF2FF]"
                }
              >
                {pokemon.moves.map((move) => (
                  <li key={move}>{move}</li>
                ))}
              </ul>
              {pokemon.evs ? (
                <p className="mt-2 text-xs text-[#F5C542]">EVs: {evs || "none"}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
