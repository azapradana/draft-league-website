import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const fieldClass =
  "w-full min-w-28 rounded-lg border border-[#243775] bg-[#070D24] p-2.5 text-[#EEF2FF]";

export default async function AdminTournamentPacksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const [{ id: tournamentId }, { updated }] = await Promise.all([
    params,
    searchParams,
  ]);
  const [tournament, packs, attachments] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, mode: true },
    }),
    prisma.pack.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tiers: true, entries: true } } },
    }),
    prisma.tournamentPack.findMany({ where: { tournamentId } }),
  ]);
  if (!tournament || tournament.mode === "REGULAR") notFound();

  const attachedByPackId = new Map(attachments.map((attachment) => [attachment.packId, attachment]));

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {updated === "1" && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-400/50 bg-emerald-950 px-5 py-3 text-sm font-semibold text-emerald-100"
          >
            Tournament pack settings saved.
          </div>
        )}
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            Packs / Gacha
          </p>
          <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            Check the packs to attach, set their tournament price and per-player limit, then save all changes together.
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
          <form action="/api/admin" method="POST">
            <input type="hidden" name="action" value="bulkUpdateTournamentPacks" />
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <input
              type="hidden"
              name="packIds"
              value={JSON.stringify(packs.map((pack) => pack.id))}
            />
            <div className="overflow-x-auto rounded-2xl border border-[#243775] bg-[#0C1638]">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#070D24]/60 text-xs uppercase tracking-wide text-[#9FB0E6]">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">In tournament</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Global pack</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Contents</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Price (coins)</th>
                    <th scope="col" className="px-4 py-4 font-semibold">Limit per player</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Offer for sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#243775]">
                  {packs.map((pack) => {
                    const attachment = attachedByPackId.get(pack.id);
                    return (
                      <tr key={pack.id} className="align-middle">
                        <td className="px-5 py-5">
                          <label className="flex items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              name={`pack.${pack.id}.attached`}
                              value="true"
                              defaultChecked={Boolean(attachment)}
                              aria-label={`Attach ${pack.name} to this tournament`}
                              className="h-4 w-4 accent-[#F5C542]"
                            />
                            <span className="sr-only">Attach</span>
                          </label>
                        </td>
                        <th scope="row" className="px-4 py-5 font-semibold text-[#EEF2FF]">
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
                          <label>
                            <span className="sr-only">{pack.name} price in tournament coins</span>
                            <input
                              name={`pack.${pack.id}.price`}
                              type="number"
                              min={0}
                              max={2_147_483_647}
                              required
                              defaultValue={attachment?.price ?? 0}
                              className={fieldClass}
                            />
                          </label>
                        </td>
                        <td className="px-4 py-5">
                          <label>
                            <span className="sr-only">{pack.name} purchase limit per player</span>
                            <input
                              name={`pack.${pack.id}.purchaseLimit`}
                              type="number"
                              min={1}
                              max={2_147_483_647}
                              defaultValue={attachment?.purchaseLimit ?? ""}
                              placeholder="Unlimited"
                              className={fieldClass}
                            />
                          </label>
                        </td>
                        <td className="px-5 py-5">
                          <label className="flex items-center gap-2 text-xs text-[#9FB0E6]">
                            <input
                              type="hidden"
                              name={`pack.${pack.id}.active`}
                              value="false"
                            />
                            <input
                              type="checkbox"
                              name={`pack.${pack.id}.active`}
                              value="true"
                              defaultChecked={attachment?.active ?? false}
                              aria-label={`Offer ${pack.name} for sale`}
                              className="h-4 w-4 accent-[#F5C542]"
                            />
                            On sale
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#9FB0E6]">
                Uncheck a pack to remove it. Leave its limit blank for unlimited purchases.
              </p>
              <button
                type="submit"
                className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B]"
              >
                Save all pack settings
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
