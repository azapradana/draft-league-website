import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeTeam } from "@/lib/team-access";
import type { TeamPokemon } from "@/lib/team-types";
import TeamEditor from "./team-editor";

export default async function TournamentTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${id}/team`)}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      mode: true,
      rostersLocked: true,
      participants: {
        where: { userId: session.user.id },
        select: { status: true, team: { select: { parsed: true, rawPaste: true } } },
      },
    },
  });
  if (!tournament || tournament.mode !== "REGULAR") notFound();

  const participant = tournament.participants[0];
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-3xl font-bold">My Team</h2>
        <p className="mt-2 max-w-2xl text-[#9FB0E6]">
          Paste a Pokémon Showdown export with exactly 6 Pokémon. Only species, item, moves,
          ability and nature are visible to others, and only when teams are public.
        </p>
      </section>
      {participant?.status !== "APPROVED" ? (
        <p className="rounded-2xl border border-dashed border-[#243775] p-6 text-[#9FB0E6]">
          An admin must approve your place in this tournament before you can submit a team.
        </p>
      ) : (
        <TeamEditor
          tournamentId={id}
          initialTeam={
            participant.team
              ? (serializeTeam(participant.team.parsed, true) as TeamPokemon[])
              : null
          }
          initialPaste={participant.team?.rawPaste ?? ""}
          locked={tournament.rostersLocked}
        />
      )}
    </div>
  );
}
