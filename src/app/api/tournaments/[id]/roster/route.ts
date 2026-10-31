import { ParticipantStatus, TournamentMode } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

class RosterError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to save your roster." }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const speciesIds =
    typeof body === "object" && body !== null && "speciesIds" in body
      ? body.speciesIds
      : undefined;
  if (
    !Array.isArray(speciesIds) ||
    speciesIds.length > 6 ||
    speciesIds.some((speciesId) => !Number.isSafeInteger(speciesId) || speciesId <= 0)
  ) {
    return NextResponse.json(
      { error: "Choose up to 6 valid Pokémon for your roster." },
      { status: 400 },
    );
  }
  if (new Set(speciesIds).size !== speciesIds.length) {
    return NextResponse.json(
      { error: "Each Pokémon species can only appear once in your roster." },
      { status: 400 },
    );
  }

  const { id: tournamentId } = await params;
  try {
    const roster = await prisma.$transaction(async (tx) => {
      const lockedTournament = await tx.$queryRaw<
        Array<{ id: string; rostersLocked: boolean; mode: TournamentMode }>
      >`
        SELECT "id", "rostersLocked", "mode" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE
      `;
      if (lockedTournament.length === 0 || lockedTournament[0].mode !== TournamentMode.GACHA) {
        throw new RosterError("Tournament not found.", 404);
      }
      if (lockedTournament[0].rostersLocked) {
        throw new RosterError("Rosters are locked by the tournament admin.", 409);
      }

      const participant = await tx.participant.findUnique({
        where: {
          userId_tournamentId: {
            userId,
            tournamentId,
          },
        },
        select: { id: true, status: true },
      });
      if (!participant || participant.status !== ParticipantStatus.APPROVED) {
        throw new RosterError(
          "You need an approved tournament place before you can save a roster.",
          403,
        );
      }

      if (speciesIds.length > 0) {
        const ownedSpecies = await tx.ownedPokemon.groupBy({
          by: ["speciesDex"],
          where: {
            participantId: participant.id,
            speciesDex: { in: speciesIds },
          },
        });
        if (ownedSpecies.length !== speciesIds.length) {
          throw new RosterError(
            "Your roster can only include Pokémon in your collection.",
            400,
          );
        }
      }

      return tx.roster.upsert({
        where: { participantId: participant.id },
        create: { participantId: participant.id, speciesIds },
        update: { speciesIds },
        select: { speciesIds: true },
      });
    });

    return NextResponse.json(roster);
  } catch (error) {
    if (error instanceof RosterError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
