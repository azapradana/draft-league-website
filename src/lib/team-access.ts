import {
  toPublicPokemon,
  type PublicTeamPokemon,
  type TeamPokemon,
} from "@/lib/team-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

function normalize(entry: unknown): TeamPokemon | null {
  if (!isRecord(entry)) return null;
  return {
    species: text(entry.species),
    name: text(entry.name),
    item: text(entry.item),
    ability: text(entry.ability),
    nature: text(entry.nature),
    level: typeof entry.level === "number" ? entry.level : 50,
    gender: text(entry.gender),
    shiny: entry.shiny === true,
    moves: Array.isArray(entry.moves)
      ? entry.moves.filter((move): move is string => typeof move === "string")
      : [],
    evs: numberRecord(entry.evs),
    ivs: numberRecord(entry.ivs),
  };
}

// Only the admin or the team's owner may receive EVs/IVs; everyone else gets the
// public fields (species, item, moves, ability, nature) built field by field.
export function serializeTeam(
  parsed: unknown,
  includeSecrets: boolean,
): TeamPokemon[] | PublicTeamPokemon[] {
  const team = (Array.isArray(parsed) ? parsed : [])
    .map(normalize)
    .filter((entry): entry is TeamPokemon => entry !== null);
  return includeSecrets ? team : team.map(toPublicPokemon);
}

export function teamHasSixPokemon(parsed: unknown): boolean {
  return Array.isArray(parsed) && parsed.length === 6;
}
