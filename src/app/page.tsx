import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountMenu } from "@/components/auth/account-menu";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      participants: session?.user?.id
        ? {
            where: { userId: session.user.id },
            select: { status: true },
          }
        : false,
    },
  });

  return (
    <main className="min-h-screen bg-[#070D24] px-6 py-12 text-[#EEF2FF] sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
              Draft League
            </p>
            <h1 className="mt-2 text-4xl font-bold">Tournaments</h1>
          </div>
          {session?.user ? (
            <div className="flex items-center gap-3">
              {session.user.role === "ADMIN" && (
                <Link
                  className="rounded-lg border border-[#F5C542] bg-[#F5C542] px-4 py-2 text-sm font-semibold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
                  href="/admin"
                >
                  Admin
                </Link>
              )}
              <AccountMenu
                email={session.user.email}
                name={session.user.name ?? session.user.email ?? "Player"}
                role={session.user.role}
              />
            </div>
          ) : (
            <Link
              className="rounded-lg border border-[#243775] px-4 py-2 text-sm font-semibold hover:border-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
              href="/login"
            >
              Sign in
            </Link>
          )}
        </header>

        {tournaments.length === 0 ? (
          <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-8">
            <h2 className="text-xl font-semibold">No tournaments yet</h2>
            <p className="mt-2 text-[#9FB0E6]">
              Check back later for a tournament to join.
            </p>
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tournaments.map((tournament) => {
              const participation = Array.isArray(tournament.participants)
                ? tournament.participants[0]
                : undefined;
              return (
                <li key={tournament.id}>
                  <Link
                    className="block h-full rounded-2xl border border-[#243775] bg-[#0C1638] p-6 transition hover:border-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
                    href={`/t/${tournament.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-xl font-semibold">{tournament.name}</h2>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          tournament.completed
                            ? "bg-emerald-950 text-emerald-300"
                            : tournament.active
                            ? "bg-[#F5C542] text-[#070D24]"
                            : "bg-[#243775] text-[#9FB0E6]"
                        }`}
                      >
                        {tournament.completed
                          ? "Completed"
                          : tournament.active
                            ? "Active"
                            : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#9FB0E6]">
                      Regulation {tournament.regulation.toUpperCase()} ·{" "}
                      {tournament.startingCoins.toLocaleString()} starting coins
                    </p>
                    {participation && (
                      <p className="mt-4 text-sm font-semibold text-[#F5C542]">
                        Your status: {participation.status}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
