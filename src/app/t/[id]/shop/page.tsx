import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTournamentShopPacks } from "@/lib/pack-data";
import ShopPacks from "./shop-packs";

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

  const [tournament, packs] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        active: true,
        participants: {
          where: { userId: session.user.id },
          select: { status: true, coins: true },
        },
      },
    }),
    getTournamentShopPacks(id),
  ]);
  if (!tournament) notFound();

  const participant = tournament.participants[0];

  return (
    <ShopPacks
      tournamentId={id}
      packs={packs}
      tournamentActive={tournament.active}
      approved={participant?.status === "APPROVED"}
      initialTournamentCoins={participant?.coins ?? null}
    />
  );
}
