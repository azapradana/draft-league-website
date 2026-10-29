import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImageUpload } from "@/components/ImageUpload";
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
    include: {
      _count: {
        select: {
          matches: true,
          participants: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
              Admin workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Tournaments
            </h1>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              Manage events, players, brackets, and packs from one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/settings"
              className="rounded-lg border border-[#243775] px-4 py-3 text-sm font-semibold text-[#9FB0E6] transition hover:border-[#F5C542] hover:text-[#EEF2FF]"
            >
              Website settings
            </Link>
            <a
              href="#create-tournament"
              className="rounded-lg bg-[#F5C542] px-5 py-3 text-sm font-bold text-[#070D24] transition hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542]"
            >
              Create Tournament
            </a>
          </div>
        </header>

        <section
          aria-labelledby="tournaments-heading"
          className="overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638]"
        >
          <div className="flex items-center justify-between border-b border-[#243775] px-5 py-4 sm:px-6">
            <div>
              <h2 id="tournaments-heading" className="text-lg font-semibold">
                All tournaments
              </h2>
              <p className="mt-1 text-sm text-[#9FB0E6]">
                {tournaments.length} {tournaments.length === 1 ? "tournament" : "tournaments"}
              </p>
            </div>
          </div>

          {tournaments.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-[#9FB0E6]">
              No tournaments yet. Create your first tournament to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#070D24]/60 text-xs uppercase tracking-wide text-[#9FB0E6]">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-semibold">
                      Tournament name
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Format
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-4 text-right font-semibold">
                      Participants
                    </th>
                    <th scope="col" className="px-6 py-4 text-right font-semibold">
                      Manage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#243775]">
                  {tournaments.map((tournament) => {
                    const status = tournament.completed
                      ? "COMPLETED"
                      : tournament._count.matches > 0
                        ? "IN_PROGRESS"
                        : tournament.active
                          ? "REGISTRATION"
                          : "DRAFT";
                    const statusClass =
                      status === "COMPLETED"
                        ? "bg-emerald-950 text-emerald-300"
                        : status === "REGISTRATION"
                          ? "bg-[#F5C542] text-[#070D24]"
                          : status === "IN_PROGRESS"
                            ? "bg-blue-950 text-blue-200"
                            : "bg-[#243775] text-[#C2CCF2]";

                    return (
                      <tr
                        key={tournament.id}
                        className="transition-colors hover:bg-[#122050]/60"
                      >
                        <th scope="row" className="px-6 py-4 font-semibold text-[#EEF2FF]">
                          {tournament.name}
                        </th>
                        <td className="px-5 py-4 text-[#C2CCF2]">
                          Regulation {tournament.regulation.toUpperCase()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${statusClass}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-[#C2CCF2]">
                          {tournament._count.participants}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/t/${tournament.id}`}
                            className="inline-flex items-center rounded-lg border border-[#243775] px-4 py-2 font-semibold text-[#EEF2FF] transition hover:border-[#F5C542] hover:text-[#F5C542] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="create-tournament"
          className="mt-10 scroll-mt-6 rounded-2xl border border-[#243775] bg-[#0C1638] p-5 sm:p-7"
        >
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F5C542]">
              New event
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Create tournament</h2>
          </div>

          <form action="/api/admin" method="POST" className="grid gap-4 md:grid-cols-2">
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

            <div className="md:col-span-2">
              <ImageUpload name="imageUrl" label="Tournament banner" />
            </div>

            <div className="md:col-span-2">
              <ImageUpload name="cardBackImage" label="Card back image" />
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
      </div>
    </main>
  );
}
