import { ParticipantStatus, Prisma } from "@prisma/client";
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
  const userId = session.user.id;

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, startingCoins: true, maxParticipants: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const currentTournament = await transaction.tournament.findUnique({
          where: { id: tournament.id },
          select: {
            startingCoins: true,
            maxParticipants: true,
            autoApproveSignups: true,
          },
        });
        if (!currentTournament) {
          return { kind: "not-found" as const };
        }

        const existingParticipant = await transaction.participant.findUnique({
          where: {
            userId_tournamentId: {
              userId,
              tournamentId: tournament.id,
            },
          },
        });
        if (existingParticipant) {
          return { kind: "existing" as const };
        }

        if (currentTournament.maxParticipants !== null) {
          const activeParticipantCount = await transaction.participant.count({
            where: {
              tournamentId: tournament.id,
              status: {
                in: [ParticipantStatus.PENDING, ParticipantStatus.APPROVED],
              },
            },
          });
          if (activeParticipantCount >= currentTournament.maxParticipants) {
            return { kind: "full" as const };
          }
        }

        const participant = await transaction.participant.create({
          data: {
            userId,
            tournamentId: tournament.id,
            status: currentTournament.autoApproveSignups
              ? ParticipantStatus.APPROVED
              : ParticipantStatus.PENDING,
            coins: currentTournament.startingCoins,
          },
          select: { status: true, coins: true },
        });
        return { kind: "created" as const, participant };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
    }
    if (result.kind === "existing") {
      return NextResponse.json(
        { error: "You already have a participation record for this tournament." },
        { status: 409 },
      );
    }
    if (result.kind === "full") {
      return NextResponse.json(
        { error: "This tournament has reached its participant limit." },
        { status: 409 },
      );
    }

    return NextResponse.json(result.participant, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "You already have a participation record for this tournament." },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Tournament capacity changed while joining. Please try again." },
        { status: 409 },
      );
    }

    throw error;
  }
}
