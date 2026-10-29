import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TournamentNavigation from "./tournament-navigation";
import { CoinBalanceProvider } from "./coin-balance";

export default async function TournamentLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: {
        where: { userId: session.user.id },
        select: { coins: true },
      },
    },
  });

  if (!tournament) notFound();

  const coinBalance = Array.isArray(tournament.participants)
    ? tournament.participants[0]?.coins
    : undefined;
  return (
    <CoinBalanceProvider key={id} initialBalance={coinBalance ?? null}>
      <div className="min-h-screen overflow-x-hidden bg-[#070D24] text-[#EEF2FF]">
        <TournamentNavigation
          tournamentId={id}
          tournamentName={tournament.name}
          swissFormat={tournament.format === "SWISS"}
          active={tournament.active}
          completed={tournament.completed}
          email={session.user.email}
          name={session.user.name ?? session.user.email ?? "Player"}
          role={session.user.role}
        />
        <main className="mx-auto min-w-0 max-w-5xl px-4 py-8 sm:px-8 sm:py-10 md:ml-64 md:max-w-none md:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </CoinBalanceProvider>
  );
}
