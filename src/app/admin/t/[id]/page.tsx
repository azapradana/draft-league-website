import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: {
        orderBy: { id: "asc" },
        include: {
          user: {
            select: { id: true, username: true, name: true, email: true },
          },
        },
      },
      packs: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { purchases: true, tiers: true, entries: true } },
        },
      },
    },
  });

  if (!tournament) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#070D24] px-6 py-10 text-[#EEF2FF] sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm text-[#9FB0E6] hover:text-[#EEF2FF]">
          ← Back to admin dashboard
        </Link>

        <div className="mt-4 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
                Tournament settings
              </p>
              <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/t/${tournament.id}/matches`}
                className="rounded-lg border border-[#F5C542] px-4 py-2 text-sm font-bold text-[#F5C542] hover:bg-[#F5C542] hover:text-[#070D24]"
              >
                Manage bracket
              </Link>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  tournament.active
                    ? "bg-[#F5C542] text-[#070D24]"
                    : "bg-[#243775] text-[#9FB0E6]"
                }`}
              >
                {tournament.active ? "Open" : "Closed"}
              </span>
            </div>
          </div>

          <form action="/api/admin" method="POST" className="mt-6 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="action" value="updateTournament" />
            <input type="hidden" name="id" value={tournament.id} />

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Name</span>
              <input
                name="name"
                defaultValue={tournament.name}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Starting coins</span>
              <input
                name="startingCoins"
                type="number"
                min={0}
                defaultValue={tournament.startingCoins}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Max copies per player</span>
              <input
                name="maxCopiesPerPlayer"
                type="number"
                min={1}
                defaultValue={tournament.maxCopiesPerPlayer}
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Max copies league-wide</span>
              <input
                name="maxCopiesLeague"
                type="number"
                min={0}
                defaultValue={tournament.maxCopiesLeague ?? ""}
                placeholder="blank = no limit"
                className="w-full rounded-lg border border-[#243775] bg-[#070D24] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="active"
                defaultChecked={tournament.active}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Open / active</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="rostersLocked"
                defaultChecked={tournament.rostersLocked}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Lock roster editing</span>
            </label>

            <label className="flex items-center gap-3">
              <input type="hidden" name="rostersPublic" value="false" />
              <input
                type="checkbox"
                name="rostersPublic"
                value="true"
                defaultChecked={tournament.rostersPublic}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">
                Open rosters for participants to view
              </span>
            </label>

            <label className="flex items-center gap-3">
              <input type="hidden" name="checkInOpen" value="false" />
              <input
                type="checkbox"
                name="checkInOpen"
                value="true"
                defaultChecked={tournament.checkInOpen}
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Open participant check-in</span>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
              >
                Save tournament settings
              </button>
            </div>
          </form>
        </div>

        <section className="mt-8 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <h2 className="text-xl font-semibold">Participants</h2>

          {tournament.participants.length === 0 ? (
            <p className="mt-4 text-[#9FB0E6]">No players have joined this tournament yet.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {tournament.participants.map((participant) => {
                const playerName =
                  participant.user.name ??
                  participant.user.username ??
                  participant.user.email ??
                  "Unnamed player";

                return (
                  <li
                    key={participant.id}
                    className="rounded-xl border border-[#243775] bg-[#070D24] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="font-semibold">{playerName}</h3>
                        <p className="mt-1 text-sm text-[#9FB0E6]">
                          Status: <span className="font-semibold text-[#EEF2FF]">{participant.status}</span>
                        </p>
                        <p className="mt-1 text-sm text-[#9FB0E6]">
                          Coins: <span className="font-semibold text-[#EEF2FF]">{participant.coins.toLocaleString()}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <form action="/api/admin" method="POST">
                          <input type="hidden" name="action" value="setParticipant" />
                          <input type="hidden" name="participantId" value={participant.id} />
                          <input type="hidden" name="tournamentId" value={tournament.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={participant.status === "APPROVED" ? "REJECTED" : "APPROVED"}
                          />
                          <button
                            type="submit"
                            className={
                              participant.status === "APPROVED"
                                ? "rounded-lg border border-red-400 px-3 py-2 font-bold text-red-300 hover:bg-red-950"
                                : "rounded-lg bg-[#F5C542] px-3 py-2 font-bold text-[#070D24] hover:bg-[#D9A21B]"
                            }
                          >
                            {participant.status === "APPROVED" ? "Kick out participant" : "Approve"}
                          </button>
                        </form>

                        {participant.status === "PENDING" && (
                          <form action="/api/admin" method="POST">
                            <input type="hidden" name="action" value="setParticipant" />
                            <input type="hidden" name="participantId" value={participant.id} />
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="status" value="REJECTED" />
                            <button
                              type="submit"
                              className="rounded-lg border border-[#243775] px-3 py-2 font-bold text-[#EEF2FF] hover:border-[#F5C542]"
                            >
                              Decline
                            </button>
                          </form>
                        )}

                        <form action="/api/admin" method="POST" className="flex items-center gap-2">
                          <input type="hidden" name="action" value="setParticipant" />
                          <input type="hidden" name="participantId" value={participant.id} />
                          <input type="hidden" name="tournamentId" value={tournament.id} />
                          <input
                            type="number"
                            name="coins"
                            defaultValue={participant.coins}
                            className="w-24 rounded-lg border border-[#243775] bg-[#070D24] p-2 text-[#EEF2FF]"
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-[#243775] px-3 py-2 font-bold text-[#EEF2FF] hover:border-[#F5C542]"
                          >
                            Set coins
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
          <div>
            <h2 className="text-xl font-semibold">Packs</h2>
            <p className="mt-1 text-sm text-[#9FB0E6]">
              Configure pack pricing and limits, then manage its rarity tiers and Pokémon pool.
            </p>
          </div>

          <form action="/api/admin" method="POST" className="mt-6 grid gap-4 rounded-xl border border-[#243775] bg-[#070D24] p-4 md:grid-cols-2">
            <input type="hidden" name="action" value="createPack" />
            <input type="hidden" name="tournamentId" value={tournament.id} />

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Pack name</span>
              <input
                name="name"
                required
                maxLength={80}
                className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Price (coins)</span>
              <input
                name="price"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={0}
                className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Pokémon per pack</span>
              <input
                name="pullCount"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={1}
                className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-[#9FB0E6]">Per-player purchase limit</span>
              <input
                name="purchaseLimit"
                type="number"
                min={1}
                step={1}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
              />
            </label>

            <label className="flex items-center gap-3 md:col-span-2">
              <input type="hidden" name="active" value="false" />
              <input
                type="checkbox"
                name="active"
                value="true"
                defaultChecked
                className="h-4 w-4 accent-[#F5C542]"
              />
              <span className="text-sm text-[#9FB0E6]">Put on sale</span>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-[#F5C542] px-5 py-3 font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
              >
                Create pack
              </button>
            </div>
          </form>

          {tournament.packs.length === 0 ? (
            <p className="mt-5 text-[#9FB0E6]">No packs have been created for this tournament yet.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {tournament.packs.map((pack) => (
                <li key={pack.id} className="rounded-xl border border-[#243775] bg-[#070D24] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{pack.name}</h3>
                      <p className="mt-1 text-sm text-[#9FB0E6]">
                        {pack._count.purchases} purchases · {pack._count.tiers} tiers · {pack._count.entries} Pokémon in pool
                      </p>
                    </div>
                    <Link
                      href={`/admin/t/${tournament.id}/packs/${pack.id}`}
                      className="rounded-lg border border-[#243775] px-3 py-2 font-semibold text-[#EEF2FF] hover:border-[#F5C542]"
                    >
                      Edit tiers and pool
                    </Link>
                  </div>

                  <form action="/api/admin" method="POST" className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="action" value="updatePack" />
                    <input type="hidden" name="id" value={pack.id} />

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#9FB0E6]">Pack name</span>
                      <input
                        name="name"
                        required
                        maxLength={80}
                        defaultValue={pack.name}
                        className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#9FB0E6]">Price (coins)</span>
                      <input
                        name="price"
                        type="number"
                        min={0}
                        step={1}
                        required
                        defaultValue={pack.price}
                        className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#9FB0E6]">Pokémon per pack</span>
                      <input
                        name="pullCount"
                        type="number"
                        min={1}
                        step={1}
                        required
                        defaultValue={pack.pullCount}
                        className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-[#9FB0E6]">Per-player purchase limit</span>
                      <input
                        name="purchaseLimit"
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={pack.purchaseLimit ?? ""}
                        placeholder="Unlimited"
                        className="w-full rounded-lg border border-[#243775] bg-[#0C1638] p-3 text-[#EEF2FF]"
                      />
                    </label>

                    <label className="flex items-center gap-3 md:col-span-2">
                      <input type="hidden" name="active" value="false" />
                      <input
                        type="checkbox"
                        name="active"
                        value="true"
                        defaultChecked={pack.active}
                        className="h-4 w-4 accent-[#F5C542]"
                      />
                      <span className="text-sm text-[#9FB0E6]">On sale</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-[#F5C542] px-4 py-2 font-bold text-[#070D24] hover:bg-[#D9A21B]"
                      >
                        Save pack
                      </button>
                    </div>
                  </form>

                  {pack._count.purchases === 0 ? (
                    <form action="/api/admin" method="POST" className="mt-3">
                      <input type="hidden" name="action" value="deletePack" />
                      <input type="hidden" name="id" value={pack.id} />
                      <input type="hidden" name="tournamentId" value={tournament.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-500/60 px-4 py-2 font-semibold text-red-300 hover:bg-red-950"
                      >
                        Delete pack
                      </button>
                    </form>
                  ) : (
                    <p className="mt-3 text-sm text-[#9FB0E6]">Packs with purchases cannot be deleted.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
