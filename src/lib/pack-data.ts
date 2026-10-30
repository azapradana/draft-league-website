import { revalidateTag, unstable_cache } from "next/cache";
import type { ShopPack } from "@/app/t/[id]/shop/shop-packs";
import type { SimulatorPack } from "@/app/simulator/pack-simulator";
import { prisma } from "@/lib/prisma";

const PACK_CATALOG_CACHE_TAG = "pack-catalog";

const loadTournamentShopPacks = unstable_cache(
  async (tournamentId: string): Promise<ShopPack[]> => {
    const packs = await prisma.tournamentPack.findMany({
      where: { tournamentId, active: true },
      orderBy: { pack: { name: "asc" } },
      select: {
        price: true,
        pack: {
          select: {
            id: true,
            name: true,
            packImage: true,
            tiers: {
              orderBy: { id: "asc" },
              select: {
                name: true,
                color: true,
                weight: true,
                minimumOne: true,
                entries: {
                  orderBy: { species: { name: "asc" } },
                  select: { species: { select: { dex: true, name: true } } },
                },
              },
            },
          },
        },
      },
    });

    return packs.map(({ price, pack }) => ({
      id: pack.id,
      name: pack.name,
      packImage: pack.packImage,
      price,
      tiers: pack.tiers.map((tier) => ({
        name: tier.name,
        color: tier.color,
        weight: Number(tier.weight),
        minimumOne: tier.minimumOne,
        species: tier.entries.map(({ species }) => species),
      })),
    }));
  },
  ["tournament-shop-packs"],
  { revalidate: 60, tags: [PACK_CATALOG_CACHE_TAG] },
);

const loadPracticePacks = unstable_cache(
  async (): Promise<SimulatorPack[]> => {
    const packs = await prisma.tournamentPack.findMany({
      where: { pack: { showInPractice: true } },
      orderBy: [{ tournament: { name: "asc" } }, { pack: { name: "asc" } }],
      select: {
        tournament: { select: { id: true, name: true } },
        pack: {
          select: {
            id: true,
            name: true,
            packImage: true,
            pullCount: true,
            tiers: {
              orderBy: { id: "asc" },
              select: {
                name: true,
                color: true,
                weight: true,
                minimumOne: true,
                entries: {
                  orderBy: { species: { name: "asc" } },
                  select: {
                    species: {
                      select: {
                        dex: true,
                        name: true,
                        isMega: true,
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return packs.map(({ tournament, pack }) => ({
      id: `${tournament.id}:${pack.id}`,
      tournamentName: tournament.name,
      name: pack.name,
      packImage: pack.packImage,
      pullCount: pack.pullCount,
      tiers: pack.tiers.map((tier) => ({
        name: tier.name,
        color: tier.color,
        weight: Number(tier.weight),
        minimumOne: tier.minimumOne,
        species: tier.entries.map(({ species }) => species),
      })),
    }));
  },
  ["practice-packs"],
  { revalidate: 60, tags: [PACK_CATALOG_CACHE_TAG] },
);

export function getTournamentShopPacks(tournamentId: string) {
  return loadTournamentShopPacks(tournamentId);
}

export function getPracticePacks() {
  return loadPracticePacks();
}

export function revalidatePackDataCache() {
  revalidateTag(PACK_CATALOG_CACHE_TAG, { expire: 0 });
}
