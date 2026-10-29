import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RichTextEditor } from "@/components/rich-text-editor";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const tournaments = await prisma.tournament.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-[#070D24] px-6 py-10 text-[#EEF2FF] sm:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold">Tournament dashboard</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-[#243775] px-4 py-2 text-sm font-semibold hover:border-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
          >
            Back to tournaments
          </Link>
        </div>

        <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <h2 className="text-xl font-semibold">Create tournament</h2>

          <form action="/api/admin" method="POST" className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="action" value="createTournament" />

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Name</span>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
                placeholder="Spring Open"
              />
            </label>

            <div className="md:col-span-2">
              <RichTextEditor
                name="description"
                label="Tournament description"
                placeholder="Share the format, schedule, rules, and anything players should know."
              />
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Starting coins</span>
              <input
                name="startingCoins"
                type="number"
                min={0}
                defaultValue={500}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Max copies per player</span>
              <input
                name="maxCopiesPerPlayer"
                type="number"
                min={1}
                defaultValue={3}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Max copies league-wide</span>
              <input
                name="maxCopiesLeague"
                type="number"
                min={0}
                placeholder="Leave blank for no limit"
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
              >
                Create tournament
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <h2 className="text-xl font-semibold">Tournaments</h2>

          {tournaments.length === 0 ? (
            <p className="mt-4 text-[#9FB0E6]">No tournaments found.</p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {tournaments.map((tournament) => (
                <li key={tournament.id}>
                  <Link
                    href={`/admin/t/${tournament.id}`}
                    className="block rounded-2xl border border-[#243775] bg-[#070D24] p-5 transition hover:border-[#F5C542]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold">{tournament.name}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
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
                            ? "Open"
                            : "Closed"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#9FB0E6]">
                      Starting coins: {tournament.startingCoins.toLocaleString()} ·
                      Max copies: {tournament.maxCopiesPerPlayer}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
