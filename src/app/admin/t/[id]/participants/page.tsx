import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ParticipantLineupButton from "../participant-lineup-button";
import AddFriendlyMatchPlayerForm from "../add-friendly-match-player-form";

export default async function AdminTournamentParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      format: true,
      friendlyMatchSize: true,
      friendlyMatchGroup: { select: { id: true, name: true } },
      _count: { select: { matches: true } },
      participants: {
        orderBy: { id: "asc" },
        include: {
          user: {
            select: {
              username: true,
              name: true,
              email: true,
            },
          },
          friendlyMatchGroup: { select: { name: true } },
        },
      },
    },
  });
  if (!tournament) notFound();
  const coreGroup =
    tournament.format === "FRIENDLY_MATCH"
      ? await prisma.group.findFirst({
          where: { isCore: true },
          select: { id: true, name: true },
        })
      : null;

  return (
    <main className="min-h-screen bg-[#070D24] px-4 py-8 text-[#EEF2FF] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F5C542]">
            Participants
          </p>
          <h1 className="mt-2 text-3xl font-bold">{tournament.name}</h1>
          <p className="mt-2 text-sm text-[#9FB0E6]">
            Review join requests, manage player status, and check check-in progress.
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[#243775] bg-[#0C1638]">
          <div className="flex items-center justify-between border-b border-[#243775] px-5 py-4">
            <h2 className="font-semibold">Player roster</h2>
            <span className="text-sm text-[#9FB0E6]">{tournament.participants.length} total</span>
          </div>
          {tournament.participants.length === 0 ? (
            <p className="px-5 py-10 text-center text-[#9FB0E6]">
              No players have joined this tournament yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#243775]">
              {tournament.participants.map((participant) => {
                const playerName =
                  participant.user.name ??
                  participant.user.username ??
                  participant.user.email ??
                  "Unnamed player";

                return (
                  <li
                    key={participant.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-52">
                      <h3 className="font-semibold">{playerName}</h3>
                      <p className="mt-1 text-sm text-[#9FB0E6]">
                        Status: <span className="font-semibold text-[#EEF2FF]">{participant.status}</span>
                      </p>
                      <p className="mt-1 text-sm text-[#9FB0E6]">
                        Check-in:{" "}
                        <span className={participant.checkedIn ? "font-semibold text-emerald-300" : "font-semibold text-[#EEF2FF]"}>
                          {participant.checkedIn ? "Checked in" : "Not checked in"}
                        </span>
                      </p>
                      {tournament.format === "FRIENDLY_MATCH" && (
                        <p className="mt-1 text-sm text-[#9FB0E6]">
                          Group: {participant.friendlyMatchGroup?.name ?? "Unassigned"}
                          {participant.friendlyMatchSubstitute && " · Substitute"}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {tournament.format === "FRIENDLY_MATCH" &&
                        tournament._count.matches === 0 &&
                        participant.status === "APPROVED" && (
                          <ParticipantLineupButton
                            tournamentId={tournament.id}
                            participantId={participant.id}
                            isForced={participant.friendlyMatchForcedLineup}
                          />
                        )}
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
                              ? "rounded-lg border border-red-400 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-950"
                              : "rounded-lg bg-[#F5C542] px-3 py-2 text-sm font-bold text-[#070D24] hover:bg-[#D9A21B]"
                          }
                        >
                          {participant.status === "APPROVED" ? "Remove participant" : "Approve"}
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
                            className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-bold text-[#EEF2FF] hover:border-[#F5C542]"
                          >
                            Reject
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
                          aria-label={`Coins for ${playerName}`}
                          className="w-24 rounded-lg border border-[#243775] bg-[#070D24] p-2 text-[#EEF2FF]"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-[#243775] px-3 py-2 text-sm font-bold text-[#EEF2FF] hover:border-[#F5C542]"
                        >
                          Set coins
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {tournament.format === "FRIENDLY_MATCH" &&
          tournament._count.matches === 0 &&
          coreGroup &&
          tournament.friendlyMatchGroup && (
            <section className="mt-6 rounded-2xl border border-[#243775] bg-[#0C1638] p-5">
              <h2 className="font-semibold">Manual lineup assignment</h2>
              <p className="mt-1 text-sm text-[#9FB0E6]">
                Add or reassign a player directly to either group&apos;s active lineup.
              </p>
              <AddFriendlyMatchPlayerForm
                tournamentId={tournament.id}
                groups={[coreGroup, tournament.friendlyMatchGroup]}
              />
            </section>
          )}
      </div>
    </main>
  );
}
