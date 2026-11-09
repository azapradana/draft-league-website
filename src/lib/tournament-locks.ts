import type { Prisma } from "@prisma/client";

/*
 * Previously result confirmation locked a match, then the tournament during
 * completion. Drop locked the tournament, then a participant, then matches.
 * Tournament mutations must instead lock the tournament first, all existing
 * matches by ascending id second, and participants by ascending id last.
 */
export async function lockTournamentMatchesAndParticipants(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<boolean> {
  const tournament = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE
  `;
  if (tournament.length === 0) return false;

  await tx.$queryRaw`
    SELECT "id" FROM "Match" WHERE "tournamentId" = ${tournamentId}
    ORDER BY "id" ASC FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT "id" FROM "Participant" WHERE "tournamentId" = ${tournamentId}
    ORDER BY "id" ASC FOR UPDATE
  `;
  return true;
}
