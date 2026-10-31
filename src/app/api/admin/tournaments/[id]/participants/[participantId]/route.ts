import { ParticipantStatus, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to manage participants." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const { id, participantId } = await params;
  const body: unknown = await request.json();
  const friendlyMatchForcedLineup =
    typeof body === "object" &&
    body !== null &&
    "friendlyMatchForcedLineup" in body
      ? body.friendlyMatchForcedLineup
      : undefined;
  if (typeof friendlyMatchForcedLineup === "boolean") {
    const result = await prisma.$transaction(async (transaction) => {
      const tournament = await transaction.tournament.findUnique({
        where: { id },
        select: {
          format: true,
          friendlyMatchSize: true,
          friendlyMatchGroupId: true,
          _count: { select: { matches: true } },
        },
      });
      if (!tournament || tournament.format !== "FRIENDLY_MATCH") {
        return { kind: "not-friendly" as const };
      }
      if (tournament._count.matches > 0) {
        return { kind: "started" as const };
      }
      const participant = await transaction.participant.findFirst({
        where: {
          id: participantId,
          tournamentId: id,
          status: ParticipantStatus.APPROVED,
        },
        select: {
          id: true,
          friendlyMatchForcedLineup: true,
          friendlyMatchGroupId: true,
        },
      });
      if (!participant) return { kind: "not-found" as const };
      const coreGroup = await transaction.group.findFirst({
        where: { isCore: true },
        select: { id: true },
      });
      if (
        !participant.friendlyMatchGroupId ||
        (participant.friendlyMatchGroupId !== coreGroup?.id &&
          participant.friendlyMatchGroupId !== tournament.friendlyMatchGroupId)
      ) {
        return { kind: "wrong-group" as const };
      }
      if (
        friendlyMatchForcedLineup &&
        !participant.friendlyMatchForcedLineup
      ) {
        const forcedCount = await transaction.participant.count({
          where: {
            tournamentId: id,
            status: ParticipantStatus.APPROVED,
            friendlyMatchForcedLineup: true,
            friendlyMatchGroupId: participant.friendlyMatchGroupId,
          },
        });
        if (forcedCount >= tournament.friendlyMatchSize) {
          return { kind: "lineup-full" as const };
        }
      }
      await transaction.participant.update({
        where: { id: participant.id },
        data: { friendlyMatchForcedLineup },
      });
      return { kind: "updated" as const };
    });

    if (result.kind === "not-friendly") {
      return NextResponse.json(
        { error: "Manual lineups are only available for Friendly Match wars." },
        { status: 400 },
      );
    }
    if (result.kind === "started") {
      return NextResponse.json(
        { error: "The lineup cannot change after pairings have been generated." },
        { status: 409 },
      );
    }
    if (result.kind === "not-found") {
      return NextResponse.json(
        { error: "Approved participant not found." },
        { status: 404 },
      );
    }
    if (result.kind === "wrong-group") {
      return NextResponse.json(
        { error: "Only members of one of this war's groups can be assigned." },
        { status: 403 },
      );
    }
    if (result.kind === "lineup-full") {
      return NextResponse.json(
        { error: "The selected group already has the maximum forced lineup size." },
        { status: 409 },
      );
    }
    return NextResponse.json({ friendlyMatchForcedLineup });
  }

  const status =
    typeof body === "object" && body !== null && "status" in body
      ? body.status
      : undefined;

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json(
      { error: "Choose an approval or decline status." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const participant = await transaction.participant.findFirst({
          where: {
            id: participantId,
            tournamentId: id,
            status: ParticipantStatus.PENDING,
          },
          select: { id: true },
        });
        if (!participant) {
          return { kind: "not-found" as const };
        }

        if (status === "APPROVED") {
          const tournament = await transaction.tournament.findUnique({
            where: { id },
            select: { maxParticipants: true },
          });
          if (!tournament) {
            return { kind: "not-found" as const };
          }
          if (tournament.maxParticipants !== null) {
            const activeParticipants = await transaction.participant.count({
              where: {
                tournamentId: id,
                id: { not: participant.id },
                status: {
                  in: [ParticipantStatus.PENDING, ParticipantStatus.APPROVED],
                },
              },
            });
            if (activeParticipants >= tournament.maxParticipants) {
              return { kind: "full" as const };
            }
          }
        }

        await transaction.participant.update({
          where: { id: participant.id },
          data: { status },
        });
        return { kind: "updated" as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "not-found") {
      return NextResponse.json(
        { error: "Pending join request not found. It may already have been reviewed." },
        { status: 404 },
      );
    }
    if (result.kind === "full") {
      return NextResponse.json(
        { error: "This tournament has reached its participant limit." },
        { status: 409 },
      );
    }

    return NextResponse.json({ status });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Tournament capacity changed while approving. Please try again." },
        { status: 409 },
      );
    }
    throw error;
  }
}
