import { prisma } from "@/lib/prisma";
import type {
  PokemonArtworkSpecies,
  TeamArtworkBySpecies,
} from "@/app/t/[id]/pokemon-artwork";

function getSpeciesNameCandidates(name: string): string[] {
  const candidates = [name];
  let separator = name.lastIndexOf("-");

  while (separator > 0) {
    candidates.push(name.slice(0, separator));
    separator = name.lastIndexOf("-", separator - 1);
  }

  return candidates;
}

export async function getTeamArtworkBySpeciesNames(
  names: string[],
): Promise<TeamArtworkBySpecies> {
  const uniqueNames = [...new Set(names)];
  const candidates = [
    ...new Set(uniqueNames.flatMap(getSpeciesNameCandidates).filter(Boolean)),
  ];
  const species = candidates.length
    ? await prisma.species.findMany({
        where: { name: { in: candidates, mode: "insensitive" } },
        select: { dex: true, name: true, isMega: true, imageUrl: true },
      })
    : [];
  const speciesByName = new Map(
    species.map((entry) => [entry.name.toLowerCase(), entry]),
  );

  return Object.fromEntries(
    uniqueNames.map((name) => {
      const match = getSpeciesNameCandidates(name)
        .map((candidate) => speciesByName.get(candidate.toLowerCase()))
        .find((entry) => entry !== undefined);
      const artwork: PokemonArtworkSpecies = match ?? {
        dex: 0,
        name,
        isMega: true,
        imageUrl: null,
      };

      return [name, artwork];
    }),
  );
}
