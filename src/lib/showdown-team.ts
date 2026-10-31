import { Teams } from "@pkmn/sim";
import {
  MAX_TEAM_PASTE_LENGTH,
  TEAM_SIZE,
  type TeamPokemon,
  type TeamPokemonErrors,
  type TeamValidationFailure,
} from "@/lib/team-types";

const MAX_LEVEL = 50;
const DEFAULT_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const DEFAULT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export type TeamValidationResult =
  | { ok: true; team: TeamPokemon[] }
  | ({ ok: false } & TeamValidationFailure);

function toTeamPokemon(set: NonNullable<ReturnType<typeof Teams.import>>[number]): TeamPokemon {
  return {
    species: set.species,
    name: set.name,
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    level: set.level ?? MAX_LEVEL,
    gender: set.gender,
    shiny: Boolean(set.shiny),
    moves: [...set.moves],
    evs: { ...DEFAULT_EVS, ...set.evs },
    ivs: { ...DEFAULT_IVS, ...set.ivs },
  };
}

export function validateTeamPaste(
  rawPaste: string,
  allowedSpecies: ReadonlySet<string>,
): TeamValidationResult {
  const general: string[] = [];
  const paste = rawPaste.replace(/^\s*===.*$/gm, "").trim();
  if (!paste) {
    return { ok: false, general: ["Paste a Pokémon Showdown team export."], pokemon: [] };
  }
  if (rawPaste.length > MAX_TEAM_PASTE_LENGTH) {
    return {
      ok: false,
      general: [`The paste is too long (maximum ${MAX_TEAM_PASTE_LENGTH.toLocaleString()} characters).`],
      pokemon: [],
    };
  }

  const sets = Teams.import(paste) ?? [];
  if (sets.length !== TEAM_SIZE) {
    general.push(
      `A team needs exactly ${TEAM_SIZE} Pokémon; found ${sets.length}.`,
    );
  }

  const pokemon: TeamPokemonErrors[] = [];
  const team: TeamPokemon[] = [];
  const allowedNames = [...allowedSpecies].map((species) => species.toLowerCase());

  sets.forEach((set, index) => {
    if (!set.level) set.level = MAX_LEVEL;
    const speciesName = set.species.toLowerCase();
    const inRegulation = allowedNames.some(
      (name) => speciesName === name || speciesName.startsWith(`${name}-`),
    );
    if (!inRegulation) {
      pokemon.push({
        index,
        label: set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species || `Pokémon ${index + 1}`,
        errors: [`${set.species} is not in the Regulation M-C species list.`],
      });
    }
    team.push(toTeamPokemon(set));
  });

  if (general.length > 0 || pokemon.length > 0) {
    return { ok: false, general, pokemon };
  }
  return { ok: true, team };
}
