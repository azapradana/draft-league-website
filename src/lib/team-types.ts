export const TEAM_SIZE = 6;
export const MAX_TEAM_PASTE_LENGTH = 20_000;

export type TeamPokemon = {
  species: string;
  name: string;
  item: string;
  ability: string;
  nature: string;
  level: number;
  gender: string;
  shiny: boolean;
  moves: string[];
  evs: Record<string, number>;
  ivs: Record<string, number>;
};

export type PublicTeamPokemon = Pick<
  TeamPokemon,
  "species" | "item" | "ability" | "nature" | "moves"
>;

export type TeamViewMode = "full" | "public";

export type TeamPokemonErrors = {
  index: number;
  label: string;
  errors: string[];
};

export type TeamValidationFailure = {
  general: string[];
  pokemon: TeamPokemonErrors[];
};

export function toPublicPokemon(pokemon: TeamPokemon): PublicTeamPokemon {
  return {
    species: pokemon.species,
    item: pokemon.item,
    ability: pokemon.ability,
    nature: pokemon.nature,
    moves: pokemon.moves,
  };
}
