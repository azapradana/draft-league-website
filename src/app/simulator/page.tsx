import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import PackSimulator, { type SimulatorPack } from "./pack-simulator";

export default async function SimulatorPage() {
  await connection();

  const practicePacks = await prisma.tournamentPack.findMany({
    where: {
      pack: { showInPractice: true },
    },
    orderBy: [{ tournament: { name: "asc" } }, { pack: { name: "asc" } }],
    include: {
      tournament: { select: { id: true, name: true } },
      pack: {
        include: {
          tiers: {
            orderBy: { id: "asc" },
            include: {
              entries: {
                orderBy: { species: { name: "asc" } },
                select: {
                  species: {
                    select: { dex: true, name: true, isMega: true, imageUrl: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const packs: SimulatorPack[] = practicePacks.map(({ tournament, pack }) => ({
    id: `${tournament.id}:${pack.id}`,
    tournamentName: tournament.name,
    name: pack.name,
    description: pack.description,
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

  return <PackSimulator packs={packs} />;
}
