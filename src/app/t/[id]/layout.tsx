import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TournamentNavigation from "./tournament-navigation";
import { AccountMenu } from "@/components/auth/account-menu";

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
    <div className="min-h-screen bg-[#070D24] text-[#EEF2FF]">
      <header className="border-b border-[#243775] bg-[#0C1638]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10">
          <div>
            <Link className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]" href="/">
              All tournaments
            </Link>
            <h1 className="mt-1 text-2xl font-bold">{tournament.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                tournament.active
                  ? "bg-[#F5C542] text-[#070D24]"
                  : "bg-[#243775] text-[#9FB0E6]"
              }`}
            >
              {tournament.active ? "Active" : "Inactive"}
            </span>
            <p className="text-sm font-semibold text-[#F5C542]">
              {coinBalance === undefined
                ? "Coins: —"
                : `${coinBalance.toLocaleString()} coins`}
            </p>
            <AccountMenu
              email={session.user.email}
              name={session.user.name ?? session.user.email ?? "Player"}
              role={session.user.role}
            />
          </div>
        </div>
        <TournamentNavigation tournamentId={id} />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10">{children}</main>
    </div>
  );
}
