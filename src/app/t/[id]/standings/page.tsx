import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSwissStandings } from "@/lib/tournament-standings";
import { SwissStandingsTable } from "./standings-table";

export default async function TournamentStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}/standings`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      format: true,
      swissRounds: true,
      topCut: true,
      currentStage: true,
      participants: {
        where: { status: "APPROVED", checkedIn: true },
        select: {
          id: true,
          user: { select: { name: true, username: true, email: true } },
        },
      },
      matches: {
        where: { OR: [{ stage: "SWISS" }, { stage: null }] },
        select: {
          stage: true,
          player1Id: true,
          player2Id: true,
          winnerId: true,
          status: true,
        },
      },
    },
  });
  if (!tournament) notFound();

  if (tournament.format !== "SWISS") {
    return (
      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <h2 className="text-2xl font-bold">{tournament.name}</h2>
        <p className="mt-3 text-[#9FB0E6]">
          Swiss standings are available for Swiss-format tournaments.
        </p>
      </section>
    );
  }

  const standings = buildSwissStandings(
    tournament.participants,
    tournament.matches,
  );
  const currentStage =
    tournament.currentStage === "SINGLE_ELIMINATION"
      ? "SWISS"
      : tournament.currentStage;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
          Swiss standings
        </p>
        <h2 className="mt-2 text-3xl font-bold">{tournament.name}</h2>
        <p className="mt-3 text-sm text-[#9FB0E6]">
          Match points (3 per win), then opponent match-win percentage. OMW% has
          the standard 33.3% minimum.
        </p>
        <p className="mt-2 text-sm text-[#9FB0E6]">
          {currentStage === "SWISS"
            ? `Swiss stage · ${tournament.swissRounds} scheduled rounds`
            : currentStage === "TOP_CUT"
              ? `Top ${tournament.topCut} playoff in progress`
              : tournament.topCut > 0
                ? `Swiss complete · Top ${tournament.topCut} playoff`
                : "Tournament complete"}
        </p>
      </section>

      <section className="rounded-2xl border border-[#243775] bg-[#0C1638] p-4 sm:p-6">
        <SwissStandingsTable
          standings={standings}
          topCut={tournament.topCut}
        />
      </section>
    </div>
  );
}
