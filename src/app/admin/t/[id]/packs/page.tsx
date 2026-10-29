import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const fieldClass =
  "w-full rounded-lg border border-[#243775] bg-[#070D24] p-2.5 text-[#EEF2FF]";

export default async function AdminTournamentPacksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id: tournamentId } = await params;
  const [tournament, packs, attachments] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true },
    }),
    prisma.pack.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tiers: true, entries: true } } },
    }),
    prisma.tournamentPack.findMany({ where: { tournamentId } }),
  ]);
  if (!tournament) notFound();

  const attachedByPackId = new Map(attachments.map((attachment) => [attachment.packId, attachment]));

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            Packs / Gacha
          </p>
          <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            Select global packs for this tournament and set event-specific prices, sale status, and purchase limits.
          </p>
          <Link
            href="/admin/packs"
            className="mt-4 inline-block text-sm font-semibold text-[#F5C542] hover:text-[#EEF2FF]"
          >
            Manage global pack catalog →
          </Link>
        </header>

        {packs.length === 0 ? (
          <section className="rounded-2xl border border-[#243775] bg-[#0C1638] px-5 py-12 text-center">
            <h2 className="text-lg font-semibold">No global packs available</h2>
            <p className="mt-2 text-sm text-[#9FB0E6]">
              Create reusable packs in the global pack catalog before attaching one here.
            </p>
          </section>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#243775] bg-[#0C1638]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#070D24]/60 text-xs uppercase tracking-wide text-[#9FB0E6]">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold">Global pack</th>
                  <th scope="col" className="px-4 py-4 font-semibold">Contents</th>
                  <th scope="col" className="px-4 py-4 font-semibold">Tournament settings</th>
                  <th scope="col" className="px-5 py-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243775]">
                {packs.map((pack) => {
                  const attachment = attachedByPackId.get(pack.id);
                  return (
                    <tr key={pack.id} className="align-top">
                      <th scope="row" className="px-5 py-5 font-semibold text-[#EEF2FF]">
                        <div>{pack.name}</div>
                        <Link
                          href={`/admin/packs/${pack.id}`}
                          className="mt-1 inline-block text-xs font-medium text-[#F5C542] hover:text-[#EEF2FF]"
                        >
                          Edit global drops
                        </Link>
                      </th>
                      <td className="px-4 py-5 text-[#9FB0E6]">
                        {pack._count.tiers} tiers · {pack._count.entries} Pokémon
                      </td>
                      <td className="px-4 py-5">
                        {attachment ? (
                          <form action="/api/admin" method="POST" className="grid max-w-xs gap-3">
                            <input type="hidden" name="action" value="updateTournamentPack" />
                            <input type="hidden" name="tournamentId" value={tournamentId} />
                            <input type="hidden" name="packId" value={pack.id} />
                            <label className="block">
                              <span className="mb-1 block text-xs text-[#9FB0E6]">Price (tournament coins)</span>
                              <input
                                name="price"
                                type="number"
                                min={0}
                                required
                                defaultValue={attachment.price}
                                className={fieldClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-[#9FB0E6]">Purchase limit per player</span>
                              <input
                                name="purchaseLimit"
                                type="number"
                                min={1}
                                defaultValue={attachment.purchaseLimit ?? ""}
                                placeholder="Unlimited"
                                className={fieldClass}
                              />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-[#9FB0E6]">
                              <input type="hidden" name="active" value="false" />
                              <input
                                type="checkbox"
                                name="active"
                                value="true"
                                defaultChecked={attachment.active}
                                className="h-4 w-4 accent-[#F5C542]"
                              />
                              Offer for sale in this tournament
                            </label>
                            <button
                              type="submit"
                              className="justify-self-start rounded-lg bg-[#F5C542] px-3 py-2 text-xs font-bold text-[#070D24] hover:bg-[#D9A21B]"
                            >
                              Save tournament settings
                            </button>
                          </form>
                        ) : (
                          <span className="text-[#9FB0E6]">Not attached</span>
                        )}
                      </td>
                      <td className="px-5 py-5 text-right">
                        {attachment ? (
                          <form action="/api/admin" method="POST">
                            <input type="hidden" name="action" value="detachTournamentPack" />
                            <input type="hidden" name="tournamentId" value={tournamentId} />
                            <input type="hidden" name="packId" value={pack.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-500/60 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950"
                            >
                              Detach
                            </button>
                          </form>
                        ) : (
                          <form action="/api/admin" method="POST">
                            <input type="hidden" name="action" value="attachTournamentPack" />
                            <input type="hidden" name="tournamentId" value={tournamentId} />
                            <input type="hidden" name="packId" value={pack.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-[#243775] px-3 py-2 text-xs font-semibold text-[#EEF2FF] hover:border-[#F5C542]"
                            >
                              Attach to Tournament
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
