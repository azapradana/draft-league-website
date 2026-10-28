import { ParticipantStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to request to join." }, { status: 401 });
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, startingCoins: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  try {
    const participant = await prisma.participant.create({
      data: {
        userId: session.user.id,
        tournamentId: tournament.id,
        status: ParticipantStatus.PENDING,
        coins: tournament.startingCoins,
      },
      select: { status: true, coins: true },
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You already have a participation record for this tournament." },
        { status: 409 },
      );
    }

    throw error;
  }
}
