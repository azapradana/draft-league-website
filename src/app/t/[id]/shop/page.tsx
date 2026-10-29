import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ShopPacks, { type ShopPack } from "./shop-packs";

export default async function TournamentShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}/shop`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      active: true,
      participants: {
        where: { userId: session.user.id },
        select: { status: true, coins: true },
      },
    },
  });
  if (!tournament) notFound();

  const packs = await prisma.pack.findMany({
    where: { tournamentId: id, active: true },
    orderBy: { name: "asc" },
    include: {
      tiers: {
        orderBy: { id: "asc" },
        include: {
          entries: {
            orderBy: { species: { name: "asc" } },
            select: { species: { select: { dex: true, name: true } } },
          },
        },
      },
    },
  });
  const participant = tournament.participants[0];
  const shopPacks: ShopPack[] = packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    price: pack.price,
    pullCount: pack.pullCount,
    purchaseLimit: pack.purchaseLimit,
    tiers: pack.tiers.map((tier) => ({
      name: tier.name,
      color: tier.color,
      weight: Number(tier.weight),
      species: tier.entries.map((entry) => entry.species),
    })),
  }));

  return (
    <ShopPacks
      tournamentId={id}
      packs={shopPacks}
      tournamentActive={tournament.active}
      approved={participant?.status === "APPROVED"}
      initialCoins={participant?.coins ?? null}
    />
  );
}
