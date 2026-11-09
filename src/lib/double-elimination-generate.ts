import { randomUUID } from "node:crypto";
import { ParticipantStatus, TournamentStage, type Prisma } from "@prisma/client";
import { buildDoubleEliminationBracket } from "@/lib/double-elimination-bracket";
import { advanceDoubleElimination } from "@/lib/double-elimination-progress";
import { shuffle } from "@/lib/shuffle";

export class DoubleEliminationGenerationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Caller holds the tournament, match and participant locks in that order.
export async function generateDoubleElimination(tx: Prisma.TransactionClient, tournamentId: string) {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, mode: true, startedAt: true, checkInOpen: true, completed: true },
  });
  if (!tournament) throw new DoubleEliminationGenerationError("Tournament not found.", 404);
  if (tournament.format !== "DOUBLE_ELIMINATION" || tournament.mode !== "REGULAR") {
    throw new DoubleEliminationGenerationError("Double Elimination requires Regular mode.", 400);
  }
  if (tournament.completed || !tournament.startedAt || tournament.checkInOpen) {
    throw new DoubleEliminationGenerationError("Start the tournament and close check-in before generating the bracket.", 409);
  }
  if (await tx.match.count({ where: { tournamentId } })) {
    throw new DoubleEliminationGenerationError("The bracket has already been generated.", 409);
  }
  const participants = await tx.participant.findMany({
    where: { tournamentId, status: ParticipantStatus.APPROVED, checkedIn: true, droppedAt: null },
    select: { id: true },
  });
  if (participants.length < 2) {
    throw new DoubleEliminationGenerationError("At least two approved participants must be checked in.", 409);
  }
  const seeded = shuffle(participants.map(({ id }) => id));
  const skeleton = buildDoubleEliminationBracket(seeded);
  const ids = new Map(skeleton.map((match) => [match.key, randomUUID()]));
  await tx.match.createMany({
    data: skeleton.map((match) => ({
      id: ids.get(match.key)!,
      tournamentId,
      stage: TournamentStage.SINGLE_ELIMINATION,
      bracket: match.bracket,
      roundNumber: match.round,
      bracketPosition: match.position,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
    })),
  });
  const inserted = await tx.match.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  if (inserted.length !== skeleton.length) throw new Error("Could not persist the complete bracket.");
  const links = skeleton.map((match) => ({
    id: ids.get(match.key)!,
    winId: match.nextWin ? ids.get(match.nextWin.matchKey)! : null,
    winSlot: match.nextWin?.slot ?? null,
    loseId: match.nextLose ? ids.get(match.nextLose.matchKey)! : null,
    loseSlot: match.nextLose?.slot ?? null,
  }));
  await tx.$executeRaw`
    UPDATE "Match" AS m SET
      "nextWinMatchId" = v."winId", "nextWinSlot" = v."winSlot",
      "nextLoseMatchId" = v."loseId", "nextLoseSlot" = v."loseSlot",
      "updatedAt" = CURRENT_TIMESTAMP
    FROM jsonb_to_recordset(${JSON.stringify(links)}::jsonb)
      AS v(id text, "winId" text, "winSlot" integer, "loseId" text, "loseSlot" integer)
    WHERE m.id = v.id AND m."tournamentId" = ${tournamentId}
  `;
  const seeds = seeded.map((id, index) => ({ id, seed: index + 1 }));
  await tx.$executeRaw`
    UPDATE "Participant" AS p SET "bracketSeed" = v.seed
    FROM jsonb_to_recordset(${JSON.stringify(seeds)}::jsonb) AS v(id text, seed integer)
    WHERE p.id = v.id AND p."tournamentId" = ${tournamentId}
  `;
  await advanceDoubleElimination(tx, tournamentId);
  return {
    roundNumber: 1,
    matchesCreated: skeleton.length,
    byes: skeleton.filter((match) => match.bracket === "WINNERS" && match.round === 1 && (!match.player1Id || !match.player2Id)).length,
  };
}
