import {
  MatchStatus,
  ParticipantStatus,
  TournamentFormat,
  type Prisma,
} from "@prisma/client";
import { recordFriendlyMatchParticipation } from "@/lib/friendly-match";
import { closeTournamentIfComplete } from "@/lib/tournament-completion";

export type DropResult =
  | { ok: true; forfeitedMatches: number; replacedMatches: number }
  | { ok: false; statusCode: number; error: string };

type Tx = Prisma.TransactionClient;

type Substitute = { participantId: string; warEntryId?: string };

// Bench players ordered by lowest participation first, matching how the squad is drawn.
async function findBenchSubstitutes(
  tx: Tx,
  tournamentId: string,
  dropped: { id: string; userId: string; friendlyMatchGroupId: string | null },
): Promise<Substitute[]> {
  const war = await tx.friendlyWar.findUnique({
    where: { tournamentId },
    select: { id: true },
  });

  if (war) {
    const entry = await tx.friendlyWarParticipant.findUnique({
      where: { warId_userId: { warId: war.id, userId: dropped.userId } },
      select: { groupId: true },
    });
    const groupId = entry?.groupId ?? dropped.friendlyMatchGroupId;
    if (!groupId) return [];

    const bench = await tx.friendlyWarParticipant.findMany({
      where: { warId: war.id, groupId, status: "BENCH" },
      orderBy: [{ user: { friendlyMatchCount: "asc" } }, { joinedAt: "asc" }],
      select: { id: true, userId: true },
    });
    const existing = await tx.participant.findMany({
      where: { tournamentId, userId: { in: bench.map((entry) => entry.userId) } },
      select: { id: true, userId: true, status: true, droppedAt: true },
    });
    const byUser = new Map(existing.map((participant) => [participant.userId, participant]));
    const substitutes: Substitute[] = [];
    for (const entry of bench) {
      const participant = byUser.get(entry.userId);
      if (participant?.droppedAt) continue;
      if (participant && participant.status !== ParticipantStatus.APPROVED) continue;
      const ensured =
        participant ??
        (await tx.participant.create({
          data: {
            userId: entry.userId,
            tournamentId,
            status: ParticipantStatus.APPROVED,
            checkedIn: true,
            friendlyMatchGroupId: groupId,
            friendlyMatchSubstitute: true,
          },
          select: { id: true },
        }));
      substitutes.push({ participantId: ensured.id, warEntryId: entry.id });
    }
    return substitutes;
  }

  if (!dropped.friendlyMatchGroupId) return [];
  const bench = await tx.participant.findMany({
    where: {
      tournamentId,
      status: ParticipantStatus.APPROVED,
      droppedAt: null,
      friendlyMatchSubstitute: true,
      friendlyMatchGroupId: dropped.friendlyMatchGroupId,
    },
    orderBy: [{ user: { friendlyMatchParticipationCount: "asc" } }, { id: "asc" }],
    select: { id: true },
  });
  return bench.map((participant) => ({ participantId: participant.id }));
}

export async function dropParticipant(
  tx: Tx,
  tournamentId: string,
  participantId: string,
  droppedById: string,
): Promise<DropResult> {
  // Same row lock as round generation so a drop never interleaves with pairing.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Tournament"
    WHERE "id" = ${tournamentId}
    FOR UPDATE
  `;
  if (locked.length === 0) {
    return { ok: false, statusCode: 404, error: "Tournament not found." };
  }

  const tournament = await tx.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { completed: true, format: true },
  });
  if (tournament.completed) {
    return {
      ok: false,
      statusCode: 409,
      error: "This tournament is completed and no longer accepts drops.",
    };
  }

  const participant = await tx.participant.findFirst({
    where: { id: participantId, tournamentId, status: ParticipantStatus.APPROVED },
    select: { id: true, userId: true, friendlyMatchGroupId: true },
  });
  if (!participant) {
    return { ok: false, statusCode: 404, error: "Approved participant not found." };
  }

  const marked = await tx.participant.updateMany({
    where: { id: participant.id, droppedAt: null },
    data: { droppedAt: new Date(), droppedById },
  });
  if (marked.count === 0) {
    return { ok: false, statusCode: 409, error: "This player has already dropped." };
  }

  const openMatches = await tx.match.findMany({
    where: {
      tournamentId,
      status: { in: [MatchStatus.PENDING, MatchStatus.DISPUTED] },
      OR: [{ player1Id: participant.id }, { player2Id: participant.id }],
    },
    select: { id: true, player1Id: true, player2Id: true },
  });

  const substitutes =
    tournament.format === TournamentFormat.FRIENDLY_MATCH && openMatches.length > 0
      ? await findBenchSubstitutes(tx, tournamentId, participant)
      : [];

  let forfeitedMatches = 0;
  let replacedMatches = 0;
  for (const match of openMatches) {
    const isPlayer1 = match.player1Id === participant.id;
    const opponentId = isPlayer1 ? match.player2Id : match.player1Id;

    const substitute = substitutes.shift();
    if (substitute) {
      await tx.match.update({
        where: { id: match.id },
        data: {
          ...(isPlayer1
            ? { player1Id: substitute.participantId }
            : { player2Id: substitute.participantId }),
          status: MatchStatus.PENDING,
          winnerId: null,
          isDraw: false,
          player1Vote: null,
          player2Vote: null,
          player1DrawVote: false,
          player2DrawVote: false,
        },
      });
      await tx.participant.update({
        where: { id: substitute.participantId },
        data: { friendlyMatchSubstitute: false },
      });
      if (substitute.warEntryId) {
        await tx.friendlyWarParticipant.update({
          where: { id: substitute.warEntryId },
          data: { status: "SELECTED" },
        });
      }
      replacedMatches += 1;
      continue;
    }

    if (!opponentId) continue;
    await tx.match.update({
      where: { id: match.id },
      data: {
        winnerId: opponentId,
        status: MatchStatus.COMPLETED,
        isDraw: false,
        forfeitedParticipantId: participant.id,
      },
    });
    await recordFriendlyMatchParticipation(tx, tournamentId, match.id);
    forfeitedMatches += 1;
  }

  if (forfeitedMatches > 0) {
    await closeTournamentIfComplete(tx, tournamentId);
  }

  return { ok: true, forfeitedMatches, replacedMatches };
}
