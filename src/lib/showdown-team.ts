import { TeamValidator, Teams } from "@pkmn/sim";
import {
  MAX_TEAM_PASTE_LENGTH,
  TEAM_SIZE,
  type TeamPokemon,
  type TeamPokemonErrors,
  type TeamValidationFailure,
} from "@/lib/team-types";

const MAX_LEVEL = 50;
const KEPT_BANS = new Set(["-unreleased", "-tag:unobtainable", "-nonexistent"]);

let cachedValidator: TeamValidator | null = null;

// National Dex doubles keeps the Mega Evolution data and learnset/ability/item/EV
// legality checks. Metagame bans and clauses are removed because the M-C species
// table is the only roster whitelist this site enforces.
function getValidator() {
  if (cachedValidator) return cachedValidator;
  const validator = TeamValidator.get("gen9nationaldexdoubles");
  for (const key of [...validator.ruleTable.keys()]) {
    if ((key.startsWith("-") && !KEPT_BANS.has(key)) || key.endsWith("clause")) {
      validator.ruleTable.delete(key);
    }
  }
  validator.ruleTable.maxLevel = MAX_LEVEL;
  cachedValidator = validator;
  return validator;
}

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
    evs: { ...set.evs },
    ivs: { ...set.ivs },
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

  const validator = getValidator();
  const pokemon: TeamPokemonErrors[] = [];
  const team: TeamPokemon[] = [];

  sets.forEach((set, index) => {
    const errors: string[] = [];
    if (!set.level) set.level = MAX_LEVEL;
    const problems = validator.validateSet(set, {});
    if (problems) errors.push(...problems);

    const species = validator.dex.species.get(set.species);
    if (species.exists) {
      const inRegulation =
        allowedSpecies.has(species.name) ||
        allowedSpecies.has(species.baseSpecies);
      if (!inRegulation) {
        errors.push(`${species.baseSpecies} is not in the Regulation M-C species list.`);
      }
    }
    if (errors.length > 0) {
      pokemon.push({
        index,
        label: set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species || `Pokémon ${index + 1}`,
        errors: [...new Set(errors)],
      });
    }
    team.push(toTeamPokemon(set));
  });

  if (general.length > 0 || pokemon.length > 0) {
    return { ok: false, general, pokemon };
  }
  return { ok: true, team };
}
