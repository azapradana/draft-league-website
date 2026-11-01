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
          : "grid gap-2"
      }
    >
      {team.map((pokemon, index) => {
        const evs = formatEvs(pokemon.evs);
        const artwork = artworkBySpecies[pokemon.species] ?? {
          dex: 0,
          name: pokemon.species,
          isMega: true,
          imageUrl: null,
        };
        if (!horizontal) {
          return (
            <li
              key={`${pokemon.species}-${index}`}
              className="min-w-0 rounded-xl border border-[#243775] bg-[#070D24] p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <PokemonArtwork species={artwork} className="h-10 w-10 shrink-0 text-[0.5rem]" />
                <div className="min-w-0">
                  <p className="break-words font-bold leading-tight text-[#EEF2FF]">
                    {pokemon.species}
                  </p>
                  {pokemon.item ? (
                    <p className="break-words text-xs text-[#F5C542]">@ {pokemon.item}</p>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 break-words text-xs text-[#9FB0E6]">
                {pokemon.ability || "No ability"} · {pokemon.nature || "Hardy"}
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1 min-[420px]:grid-cols-2">
                {pokemon.moves.map((move) => (
                  <li
                    key={move}
                    className="break-words rounded-md bg-[#0C1638] px-2 py-1 text-xs text-[#EEF2FF]"
                  >
                    {move}
                  </li>
                ))}
              </ul>
              {pokemon.evs ? (
                <p className="mt-2 break-words text-xs text-[#F5C542]">EVs: {evs || "none"}</p>
              ) : null}
            </li>
          );
        }
        return (
          <li
            key={`${pokemon.species}-${index}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-[#243775] bg-[#070D24] p-2 text-xs"
          >
            <PokemonArtwork species={artwork} className="h-16 w-16" />
            <div className="w-full min-w-0 text-center">
              <p className="break-words font-bold text-[#EEF2FF]">
                {pokemon.species}
                {pokemon.item ? (
                  <span className="font-normal text-[#9FB0E6]"> @ {pokemon.item}</span>
                ) : null}
              </p>
              <p className="mt-1 text-[#9FB0E6]">
                {pokemon.ability || "No ability"} · {pokemon.nature || "Hardy"}
              </p>
              <ul className="mt-2 space-y-0.5 text-[#EEF2FF]">
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
