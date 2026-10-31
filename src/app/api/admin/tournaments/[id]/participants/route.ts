import { ParticipantStatus, Prisma, TournamentFormat } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AddParticipantResult =
  | { kind: "added"; participantId: string }
  | { kind: "not-found" }
  | { kind: "not-friendly" }
  | { kind: "started" }
  | { kind: "invalid-group" }
  | { kind: "lineup-full" };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to manage participants." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  const username =
    typeof body === "object" && body !== null && "username" in body &&
    typeof body.username === "string"
      ? body.username.trim()
      : "";
  const groupId =
    typeof body === "object" && body !== null && "groupId" in body &&
    typeof body.groupId === "string"
      ? body.groupId
      : "";
  if (!username || !groupId) {
    return NextResponse.json(
      { error: "Choose an existing username and a group." },
      { status: 400 },
    );
  }

  const { id: tournamentId } = await params;
  const result = await prisma.$transaction(
    async (tx): Promise<AddParticipantResult> => {
      const lockedTournament = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE
      `;
      if (lockedTournament.length === 0) return { kind: "not-found" };

      const tournament = await tx.tournament.findUniqueOrThrow({
        where: { id: tournamentId },
        select: {
          format: true,
          friendlyMatchSize: true,
          friendlyMatchGroupId: true,
          startingCoins: true,
          _count: { select: { matches: true } },
        },
      });
      if (tournament.format !== TournamentFormat.FRIENDLY_MATCH) {
        return { kind: "not-friendly" };
      }
      if (tournament._count.matches > 0) return { kind: "started" };
      const coreGroup = await tx.group.findFirst({
        where: { isCore: true },
        select: { id: true },
      });
      if (
        groupId !== coreGroup?.id &&
        groupId !== tournament.friendlyMatchGroupId
      ) {
        return { kind: "invalid-group" };
      }
      const user = await tx.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!user) return { kind: "not-found" };

      const existing = await tx.participant.findUnique({
        where: {
          userId_tournamentId: { userId: user.id, tournamentId },
        },
        select: {
          id: true,
          friendlyMatchForcedLineup: true,
        },
      });
      if (!existing || !existing.friendlyMatchForcedLineup) {
        const forcedCount = await tx.participant.count({
          where: {
            tournamentId,
            status: ParticipantStatus.APPROVED,
            friendlyMatchForcedLineup: true,
            friendlyMatchGroupId: groupId,
            ...(existing ? { id: { not: existing.id } } : {}),
          },
        });
        if (forcedCount >= tournament.friendlyMatchSize) {
          return { kind: "lineup-full" };
        }
      }

      const participant = existing
        ? await tx.participant.update({
            where: { id: existing.id },
            data: {
              status: ParticipantStatus.APPROVED,
              checkedIn: true,
              friendlyMatchGroupId: groupId,
              friendlyMatchForcedLineup: true,
              friendlyMatchSubstitute: false,
            },
            select: { id: true },
          })
        : await tx.participant.create({
            data: {
              tournamentId,
              userId: user.id,
              status: ParticipantStatus.APPROVED,
              checkedIn: true,
              coins: tournament.startingCoins,
              friendlyMatchGroupId: groupId,
              friendlyMatchForcedLineup: true,
            },
            select: { id: true },
          });
      return { kind: "added", participantId: participant.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (result.kind === "not-found") {
    return NextResponse.json(
      { error: "Tournament or player username not found." },
      { status: 404 },
    );
  }
  if (result.kind === "not-friendly") {
    return NextResponse.json(
      { error: "Manual lineup assignments are only available for Friendly Match wars." },
      { status: 400 },
    );
  }
  if (result.kind === "started") {
    return NextResponse.json(
      { error: "The lineup cannot change after pairings have been generated." },
      { status: 409 },
    );
  }
  if (result.kind === "invalid-group") {
    return NextResponse.json(
      { error: "Choose one of this war's two groups." },
      { status: 400 },
    );
  }
  if (result.kind === "lineup-full") {
    return NextResponse.json(
      { error: "That group's forced lineup is already full." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { participantId: result.participantId },
    { status: 201 },
  );
}
