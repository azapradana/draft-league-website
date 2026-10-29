import { ParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

class CheckInError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to check in." }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: tournamentId } = await params;

  try {
    const participant = await prisma.$transaction(async (tx) => {
      const tournament = await tx.$queryRaw<
        Array<{ id: string; checkInOpen: boolean }>
      >`
        SELECT "id", "checkInOpen" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE
      `;
      if (tournament.length === 0) {
        throw new CheckInError("Tournament not found.", 404);
      }
      if (!tournament[0].checkInOpen) {
        throw new CheckInError("Check-in is currently closed.", 409);
      }

      const existingParticipant = await tx.participant.findUnique({
        where: {
          userId_tournamentId: {
            userId,
            tournamentId,
          },
        },
        select: { id: true, status: true, checkedIn: true },
      });
      if (
        !existingParticipant ||
        existingParticipant.status !== ParticipantStatus.APPROVED
      ) {
        throw new CheckInError(
          "You need an approved tournament place before you can check in.",
          403,
        );
      }

      if (existingParticipant.checkedIn) {
        return existingParticipant;
      }

      return tx.participant.update({
        where: { id: existingParticipant.id },
        data: { checkedIn: true },
        select: { id: true, status: true, checkedIn: true },
      });
    });

    return NextResponse.json(participant);
  } catch (error) {
    if (error instanceof CheckInError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
