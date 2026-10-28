import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import JoinTournamentButton from "./join-tournament-button";

export default async function TournamentOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        select: { status: true },
      },
    },
  });

  if (!tournament) notFound();

  const participation = Array.isArray(tournament.participants)
    ? tournament.participants[0]
    : undefined;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Tournament overview
        </p>
        <h2 className="mt-2 text-3xl font-bold">{tournament.name}</h2>
        <p className="mt-3 max-w-2xl text-[#9FB0E6]">
          Review the tournament settings and your participation status.
        </p>
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <h3 className="text-xl font-semibold">Rules and settings</h3>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[#9FB0E6]">Regulation</dt>
            <dd className="mt-1 font-semibold">
              {tournament.regulation.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">Starting coins</dt>
            <dd className="mt-1 font-semibold text-[#F5C542]">
              {tournament.startingCoins.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">Copy limit per player</dt>
            <dd className="mt-1 font-semibold">
              {tournament.maxCopiesPerPlayer}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[#9FB0E6]">League-wide copy limit</dt>
            <dd className="mt-1 font-semibold">
              {tournament.maxCopiesLeague ?? "No limit"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <h3 className="text-xl font-semibold">Your participation</h3>
        {participation ? (
          <div className="mt-4">
            <p className="text-[#9FB0E6]">
              Status:{" "}
              <span className="font-bold text-[#EEF2FF]">
                {participation.status}
              </span>
            </p>
            {participation.status === "PENDING" && (
              <p className="mt-2 text-sm text-[#9FB0E6]">
                An admin will review your request.
              </p>
            )}
            {participation.status === "APPROVED" && (
              <p className="mt-2 text-sm text-[#9FB0E6]">
                Your request was approved. You can now buy packs and manage your roster.
              </p>
            )}
            {participation.status === "REJECTED" && (
              <p className="mt-2 text-sm text-[#9FB0E6]">
                Your request was declined. Contact a tournament admin if you
                think this is a mistake.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[#9FB0E6]">You have not joined this tournament.</p>
            <JoinTournamentButton tournamentId={id} />
          </div>
        )}
      </section>
    </div>
  );
}
