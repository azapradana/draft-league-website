import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finalizeSquad, joinWar, leaveWar } from "./actions";
import { WarActionButton } from "./war-action-button";

const STATUS_LABEL = {
  DRAFT: "Draft",
  OPEN: "Opt-in open",
  IN_PROGRESS: "Roster locked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export default async function WarOptInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}/war`)}`);
  }

  const war = await prisma.friendlyWar.findUnique({
    where: { tournamentId: id },
    include: {
      tournament: { select: { name: true } },
      groups: { include: { group: { select: { name: true, logoUrl: true, isCore: true } } } },
      entries: {
        where: { group: { isCore: true } },
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          userId: true,
          status: true,
          forceAssigned: true,
          user: { select: { username: true, name: true, friendlyMatchCount: true } },
        },
      },
    },
  });
  if (!war) notFound();

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { group: { select: { isCore: true } } },
  });
  const isCoreMember = Boolean(me?.group?.isCore);
  const isAdmin = session.user.role === "ADMIN";
  const isOpen = war.status === "OPEN";

  const myEntry = war.entries.find((entry) => entry.userId === session.user.id);
  const forcedCount = war.entries.filter((e) => e.forceAssigned && e.status === "SELECTED").length;
  const slots = Math.max(0, war.squadSize - forcedCount);
  const queue = war.entries.filter((e) => !(e.forceAssigned && e.status === "SELECTED"));
  const name = (entry: (typeof war.entries)[number]) => entry.user.username ?? entry.user.name ?? "Player";

  let statusText = "You have not joined this war.";
  if (myEntry) {
    if (myEntry.status === "SELECTED") statusText = "You are on the active roster.";
    else if (myEntry.status === "BENCH") {
      const bench = war.entries
        .filter((e) => e.status === "BENCH")
        .sort(
          (a, b) =>
            a.user.friendlyMatchCount - b.user.friendlyMatchCount ||
            a.id.localeCompare(b.id),
        );
      statusText = `You are on the substitute bench (#${bench.findIndex((e) => e.id === myEntry.id) + 1} of ${bench.length}).`;
    } else {
      const lower = queue.filter(
        (e) => e.user.friendlyMatchCount < myEntry.user.friendlyMatchCount,
      ).length;
      const tied = queue.filter(
        (e) => e.user.friendlyMatchCount === myEntry.user.friendlyMatchCount,
      ).length;
      if (queue.length <= slots || lower + tied <= slots) {
        statusText = "Joined — you are currently inside the squad.";
      } else if (lower >= slots) {
        statusText = `Joined — currently on the bench (${lower} players have lower priority counts ahead of you).`;
      } else {
        statusText = `Joined — tied with ${tied - 1} other player(s) for the last ${slots - lower} spot(s); the draw is random.`;
      }
    }
  }

  const rosterGroups = [
    { title: "Active roster", entries: war.entries.filter((e) => e.status === "SELECTED") },
    { title: "Substitute bench", entries: war.entries.filter((e) => e.status === "BENCH") },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-white">
      <Link className="text-sm font-semibold text-amber-300 hover:underline" href={`/t/${id}`}>
        ← Back to tournament
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{war.tournament?.name ?? "Friendly Match"} — War</h1>
        <p className="text-sm text-slate-300">
          {war.groups.map((g) => g.group.name).join(" vs ") || "7DS vs rival"} · {war.squadSize} vs{" "}
          {war.squadSize} · {STATUS_LABEL[war.status]}
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <dl className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <dt className="text-slate-400">Squad size</dt>
            <dd className="text-xl font-semibold">{war.squadSize}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Opted in</dt>
            <dd className="text-xl font-semibold">{war.entries.length}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Your war count</dt>
            <dd className="text-xl font-semibold">{myEntry?.user.friendlyMatchCount ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-sm text-slate-200" aria-live="polite">
          {statusText}
        </p>

        {isOpen && isCoreMember && !myEntry && (
          <WarActionButton action={joinWar.bind(null, id)} label="Join War" pendingLabel="Joining…" />
        )}
        {isOpen && myEntry && !myEntry.forceAssigned && (
          <WarActionButton
            action={leaveWar.bind(null, id)}
            label="Leave War"
            pendingLabel="Leaving…"
            variant="secondary"
          />
        )}
        {isOpen && !isCoreMember && (
          <p className="text-sm text-slate-400">Only 7DS members can opt in to this war.</p>
        )}
        {!isOpen && <p className="text-sm text-slate-400">The opt-in window is closed.</p>}
      </section>

      {isAdmin && isOpen && (
        <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="font-semibold">Admin</h2>
          <p className="text-sm text-slate-300">
            Selects up to {slots} players by lowest participation count (random on ties) and benches the rest.
          </p>
          <WarActionButton
            action={finalizeSquad.bind(null, id)}
            label="Finalize roster"
            pendingLabel="Finalizing…"
          />
        </section>
      )}

      {rosterGroups.map(
        ({ title, entries }) =>
          entries.length > 0 && (
            <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-5" key={title}>
              <h2 className="font-semibold">
                {title} ({entries.length})
              </h2>
              <ul className="divide-y divide-slate-800 text-sm">
                {entries.map((entry) => (
                  <li className="flex justify-between py-2" key={entry.id}>
                    <span>
                      {name(entry)}
                      {entry.forceAssigned && <span className="ml-2 text-xs text-amber-300">admin</span>}
                    </span>
                    <span className="text-slate-400">{entry.user.friendlyMatchCount} wars</span>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}

      {isOpen && war.entries.length > 0 && (
        <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="font-semibold">Opted in ({war.entries.length})</h2>
          <ul className="divide-y divide-slate-800 text-sm">
            {war.entries.map((entry) => (
              <li className="flex justify-between py-2" key={entry.id}>
                <span>{name(entry)}</span>
                <span className="text-slate-400">{entry.user.friendlyMatchCount} wars</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
