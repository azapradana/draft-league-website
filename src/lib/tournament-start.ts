import { TournamentFormat } from "@prisma/client";
import type { NextRequest } from "next/server";
import { generateRound } from "@/app/api/admin/tournaments/[id]/rounds/round-handler";
import { finalizeCoreSquad, generateWarPairings } from "@/lib/friendly-war";
import { prisma } from "@/lib/prisma";

export type StartTournamentResult =
  | { ok: true; startedAt: Date }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string) => ({ ok: false as const, status, error });

// Irreversible: the startedAt flip is the lock, so concurrent Start requests cannot both succeed.
export async function startTournament(
  tournamentId: string,
  request: NextRequest,
): Promise<StartTournamentResult> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true, completed: true, startedAt: true },
  });
  if (!tournament) return fail(404, "Tournament not found.");
  if (tournament.completed) return fail(409, "This tournament is completed and cannot be started.");
  if (tournament.startedAt) return fail(409, "This tournament has already started.");

  if (tournament.format === TournamentFormat.FRIENDLY_MATCH) {
    // Friendly Match only generates its one-time pairings; check-in does not exist for it.
    const war = await prisma.friendlyWar.findUnique({
      where: { tournamentId },
      select: { id: true, status: true, pairingsSeeded: true },
    });
    if (war) {
      if (!war.pairingsSeeded) {
        if (war.status === "OPEN") {
          const finalized = await finalizeCoreSquad(war.id);
          if (!finalized.ok) return fail(409, finalized.error);
        }
        const paired = await generateWarPairings(war.id);
        if (!paired.ok) return fail(409, paired.error);
      }
    } else {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { checkInOpen: false },
      });
      const response = await generateRound(request, { params: Promise.resolve({ id: tournamentId }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        return fail(response.status, body.error ?? "Unable to generate the Friendly Match pairings.");
      }
    }
  }

  const startedAt = new Date();
  const updated = await prisma.tournament.updateMany({
    where: { id: tournamentId, startedAt: null, completed: false },
    data:
      tournament.format === TournamentFormat.FRIENDLY_MATCH
        ? { startedAt, checkInOpen: false }
        : { startedAt, checkInOpen: false, active: false },
  });
  if (updated.count === 0) return fail(409, "This tournament has already started.");
  return { ok: true, startedAt };
}
