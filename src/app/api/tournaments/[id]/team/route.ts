import { ParticipantStatus, Prisma, TournamentMode } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { authFailure, requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateTeamPaste } from "@/lib/showdown-team";
import { serializeTeam } from "@/lib/team-access";

class TeamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// GET: ?participantId= selects another participant's team (admin, or when teams are public).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return authFailure(auth);

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { mode: true, rostersPublic: true },
  });
  if (!tournament || tournament.mode !== TournamentMode.REGULAR) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const requestedParticipantId = request.nextUrl.searchParams.get("participantId");
  const participant = await prisma.participant.findFirst({
    where: requestedParticipantId
      ? { id: requestedParticipantId, tournamentId, status: ParticipantStatus.APPROVED }
      : { userId: auth.userId, tournamentId },
    select: { id: true, userId: true, team: { select: { parsed: true, rawPaste: true, updatedAt: true } } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  const isOwner = participant.userId === auth.userId;
  if (!isOwner && !auth.isAdmin && !tournament.rostersPublic) {
    return NextResponse.json({ error: "Teams are private." }, { status: 403 });
  }

  const full = isOwner || auth.isAdmin;
  return NextResponse.json({
    team: participant.team
      ? {
          pokemon: serializeTeam(participant.team.parsed, full),
          updatedAt: participant.team.updatedAt,
          ...(full ? { rawPaste: participant.team.rawPaste } : {}),
        }
      : null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return authFailure(auth);

  const body: unknown = await request.json().catch(() => null);
  const rawPaste =
    typeof body === "object" && body !== null && "rawPaste" in body
      ? body.rawPaste
      : undefined;
  if (typeof rawPaste !== "string") {
    return NextResponse.json({ error: "Send the team paste as text." }, { status: 400 });
  }

  const { id: tournamentId } = await params;
  const mode = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { mode: true },
  });
  if (!mode || mode.mode !== TournamentMode.REGULAR) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const species = await prisma.species.findMany({ select: { name: true } });
  const result = validateTeamPaste(rawPaste, new Set(species.map((entry) => entry.name)));
  if (!result.ok) {
    return NextResponse.json(
      { error: "Your team has validation errors.", general: result.general, pokemon: result.pokemon },
      { status: 422 },
    );
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ rostersLocked: boolean }>>`
        SELECT "rostersLocked" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE
      `;
      if (locked.length === 0) throw new TeamError("Not found.", 404);
      if (locked[0].rostersLocked) {
        throw new TeamError("Teams are locked by the tournament admin.", 409);
      }

      const participant = await tx.participant.findUnique({
        where: { userId_tournamentId: { userId: auth.userId, tournamentId } },
        select: { id: true, status: true },
      });
      if (!participant || participant.status !== ParticipantStatus.APPROVED) {
        throw new TeamError(
          "You need an approved tournament place before you can submit a team.",
          403,
        );
      }

      const parsed = result.team as unknown as Prisma.InputJsonValue;
      return tx.team.upsert({
        where: { participantId: participant.id },
        create: { participantId: participant.id, rawPaste, parsed },
        update: { rawPaste, parsed },
        select: { parsed: true, rawPaste: true, updatedAt: true },
      });
    });

    return NextResponse.json({
      team: {
        pokemon: serializeTeam(team.parsed, true),
        rawPaste: team.rawPaste,
        updatedAt: team.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TeamError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
