import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

export type InvitationCheck =
  | { ok: true; invitation: { id: string; groupId: string; groupName: string; groupLogoUrl: string | null } }
  | { ok: false; reason: string };

// Validates an invitation token against the group in the link. Never trust the groupId alone.
export async function checkRivalInvitation(
  groupId: string,
  token: string | undefined,
  db: Tx = prisma,
): Promise<InvitationCheck> {
  if (!token) return { ok: false, reason: "This invitation link is missing its token." };
  const invitation = await db.groupInvitation.findUnique({
    where: { token },
    include: { group: { select: { id: true, name: true, logoUrl: true, isCore: true } } },
  });
  if (!invitation || invitation.groupId !== groupId || invitation.group.isCore) {
    return { ok: false, reason: "This invitation link is not valid." };
  }
  if (invitation.revokedAt) return { ok: false, reason: "This invitation has been revoked." };
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "This invitation has expired." };
  }
  if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) {
    return { ok: false, reason: "This invitation has reached its usage limit." };
  }
  return {
    ok: true,
    invitation: {
      id: invitation.id,
      groupId: invitation.groupId,
      groupName: invitation.group.name,
      groupLogoUrl: invitation.group.logoUrl,
    },
  };
}

// Atomically consumes one use; returns false if another request used the last slot first.
export async function consumeInvitation(tx: Tx, invitationId: string): Promise<boolean> {
  const invitation = await tx.groupInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation) return false;
  const result = await tx.groupInvitation.updateMany({
    where: {
      id: invitationId,
      revokedAt: null,
      useCount: {
        equals: invitation.useCount,
        ...(invitation.maxUses !== null ? { lt: invitation.maxUses } : {}),
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { useCount: { increment: 1 } },
  });
  return result.count === 1;
}

export type QueueEntry = { id: string; userId: string; participationCount: number };
export type SquadSelection = { selectedIds: string[]; benchIds: string[] };

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Lowest participation count wins; ties at the cut-off are drawn at random.
// Bench order follows the same priority (lower count first, shuffled within a tier).
export function selectSquad(entries: QueueEntry[], slots: number): SquadSelection {
  const capacity = Math.max(0, slots);
  const tiers = new Map<number, QueueEntry[]>();
  for (const entry of entries) {
    const tier = tiers.get(entry.participationCount) ?? [];
    tier.push(entry);
    tiers.set(entry.participationCount, tier);
  }
  const ordered = [...tiers.keys()]
    .sort((a, b) => a - b)
    .flatMap((count) => shuffle(tiers.get(count) ?? []));
  return {
    selectedIds: ordered.slice(0, capacity).map((entry) => entry.id),
    benchIds: ordered.slice(capacity).map((entry) => entry.id),
  };
}

export type FinalizeResult =
  | { ok: true; selected: number; bench: number }
  | { ok: false; error: string };

// Closes the opt-in window and finalizes the 7DS roster. The status flip is the lock:
// only one caller can move the war from OPEN, so the draw runs exactly once.
export async function finalizeCoreSquad(warId: string): Promise<FinalizeResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.friendlyWar.updateMany({
      where: { id: warId, status: "OPEN" },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    if (locked.count === 0) return { ok: false, error: "This war is not open for roster selection." };

    const war = await tx.friendlyWar.findUniqueOrThrow({
      where: { id: warId },
      select: { squadSize: true },
    });
    const entries = await tx.friendlyWarParticipant.findMany({
      where: { warId, group: { isCore: true } },
      select: {
        id: true,
        userId: true,
        status: true,
        forceAssigned: true,
        user: { select: { friendlyMatchCount: true } },
      },
    });

    // Admin force-assigned players occupy slots and bypass the queue.
    const forced = entries.filter((entry) => entry.forceAssigned && entry.status === "SELECTED");
    const queue = entries
      .filter((entry) => !(entry.forceAssigned && entry.status === "SELECTED"))
      .map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        participationCount: entry.user.friendlyMatchCount,
      }));

    const { selectedIds, benchIds } = selectSquad(queue, war.squadSize - forced.length);
    if (selectedIds.length) {
      await tx.friendlyWarParticipant.updateMany({
        where: { id: { in: selectedIds } },
        data: { status: "SELECTED" },
      });
    }
    if (benchIds.length) {
      await tx.friendlyWarParticipant.updateMany({
        where: { id: { in: benchIds } },
        data: { status: "BENCH" },
      });
    }
    return { ok: true, selected: selectedIds.length + forced.length, bench: benchIds.length };
  });
}

// Call when a war completes: counts one participation for every selected 7DS player.
// Guarded by the status transition so repeated calls never double-increment.
export async function completeWarAndRecordParticipation(warId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const closed = await tx.friendlyWar.updateMany({
      where: { id: warId, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (closed.count === 0) return false;
    const selected = await tx.friendlyWarParticipant.findMany({
      where: { warId, status: "SELECTED", group: { isCore: true } },
      select: { userId: true },
    });
    if (selected.length) {
      await tx.user.updateMany({
        where: { id: { in: selected.map((entry) => entry.userId) } },
        data: { friendlyMatchCount: { increment: 1 } },
      });
    }
    return true;
  });
}

export type PairingResult =
  | { ok: true; pairs: number; unpaired: number }
  | { ok: false; error: string };

class PairingError extends Error {}

// Ensures a tournament Participant row exists so the user can sit in a Match slot.
async function ensureParticipant(tx: Prisma.TransactionClient, tournamentId: string, userId: string) {
  return tx.participant.upsert({
    where: { userId_tournamentId: { userId, tournamentId } },
    update: { status: "APPROVED", checkedIn: true },
    create: { userId, tournamentId, status: "APPROVED", checkedIn: true },
    select: { id: true },
  });
}

// Runs exactly once per war: pairingsSeeded is flipped atomically before any match is written,
// so concurrent or repeated calls fail instead of re-rolling the draw.
export async function generateWarPairings(warId: string): Promise<PairingResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<PairingResult> => {
      const locked = await tx.friendlyWar.updateMany({
        where: { id: warId, status: "IN_PROGRESS", pairingsSeeded: false },
        data: { pairingsSeeded: true },
      });
      if (locked.count === 0) {
        throw new PairingError(
          "Pairings can only be generated once, after the 7DS roster is finalized.",
        );
      }

      const war = await tx.friendlyWar.findUniqueOrThrow({
        where: { id: warId },
        select: {
          tournamentId: true,
          squadSize: true,
          groups: { select: { groupId: true, group: { select: { isCore: true } } } },
        },
      });
      if (!war.tournamentId) throw new PairingError("This war is not linked to a tournament.");
      const tournamentId = war.tournamentId;

      const coreGroup = await tx.group.findFirst({ where: { isCore: true }, select: { id: true } });
      const rivalGroupId = war.groups.find((g) => !g.group.isCore)?.groupId;
      if (!coreGroup || !rivalGroupId) {
        throw new PairingError("The war needs a 7DS group and a rival group.");
      }

      // Rival members registered through the invitation link are pulled into the pool.
      const rivalMembers = await tx.user.findMany({
        where: { groupId: rivalGroupId },
        select: { id: true },
      });
      for (const member of rivalMembers) {
        await tx.friendlyWarParticipant.upsert({
          where: { warId_userId: { warId, userId: member.id } },
          update: {},
          create: { warId, userId: member.id, groupId: rivalGroupId, status: "JOINED" },
        });
      }

      const entries = await tx.friendlyWarParticipant.findMany({
        where: { warId, status: { not: "BENCH" }, groupId: { in: [coreGroup.id, rivalGroupId] } },
        select: { id: true, userId: true, groupId: true, forceAssigned: true, status: true },
      });
      const pick = (groupId: string, requireSelected: boolean) => {
        const pool = entries.filter(
          (e) => e.groupId === groupId && (!requireSelected || e.status === "SELECTED"),
        );
        return [
          ...shuffle(pool.filter((e) => e.forceAssigned)),
          ...shuffle(pool.filter((e) => !e.forceAssigned)),
        ].slice(0, war.squadSize);
      };
      const core = pick(coreGroup.id, true);
      const rival = pick(rivalGroupId, false);
      const pairCount = Math.min(core.length, rival.length);
      if (pairCount === 0) {
        throw new PairingError("Both groups need at least one active player to generate pairings.");
      }

      const left = shuffle(core).slice(0, pairCount);
      const right = shuffle(rival).slice(0, pairCount);
      await tx.friendlyWarParticipant.updateMany({
        where: { id: { in: [...left, ...right].map((e) => e.id) } },
        data: { status: "SELECTED" },
      });

      for (let i = 0; i < pairCount; i++) {
        const [p1, p2] = await Promise.all([
          ensureParticipant(tx, tournamentId, left[i].userId),
          ensureParticipant(tx, tournamentId, right[i].userId),
        ]);
        await tx.match.create({
          data: {
            tournamentId,
            roundNumber: 1,
            stage: "SINGLE_ELIMINATION",
            bracketPosition: i + 1,
            player1Id: p1.id,
            player2Id: p2.id,
          },
        });
      }

      for (const groupId of [coreGroup.id, rivalGroupId]) {
        await tx.friendlyWarGroup.upsert({
          where: { warId_groupId: { warId, groupId } },
          update: {},
          create: { warId, groupId },
        });
      }
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { active: true, checkInOpen: false },
      });
      return {
        ok: true,
        pairs: pairCount,
        unpaired: core.length + rival.length - pairCount * 2,
      };
    });
  } catch (error) {
    if (error instanceof PairingError) return { ok: false, error: error.message };
    throw error;
  }
}

// Recomputes group tallies from match results (idempotent) and declares the winner once every
// pairing is settled. Returns null when the tournament is not a Friendly Match war.
export async function syncWarOutcome(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<boolean | null> {
  const war = await tx.friendlyWar.findUnique({
    where: { tournamentId },
    select: { id: true, status: true, groups: { select: { groupId: true } } },
  });
  if (!war) return null;

  const [matches, entries] = await Promise.all([
    tx.match.findMany({
      where: { tournamentId },
      select: {
        status: true,
        winnerId: true,
        player1Id: true,
        player2Id: true,
        player1: { select: { userId: true } },
        player2: { select: { userId: true } },
      },
    }),
    tx.friendlyWarParticipant.findMany({
      where: { warId: war.id },
      select: { userId: true, groupId: true },
    }),
  ]);
  const groupOf = new Map(entries.map((e) => [e.userId, e.groupId]));
  const tally = new Map(war.groups.map((g) => [g.groupId, { wins: 0, losses: 0, draws: 0 }]));

  // Matches missing a player (e.g. after an admin removal) are void.
  const real = matches.filter((m) => m.player1 && m.player2);
  for (const match of real) {
    if (match.status !== "COMPLETED") continue;
    const g1 = groupOf.get(match.player1!.userId);
    const g2 = groupOf.get(match.player2!.userId);
    const t1 = g1 ? tally.get(g1) : undefined;
    const t2 = g2 ? tally.get(g2) : undefined;
    if (match.winnerId === null) {
      if (t1) t1.draws++;
      if (t2) t2.draws++;
    } else {
      const p1Won = match.winnerId === match.player1Id;
      const winner = p1Won ? t1 : t2;
      const loser = p1Won ? t2 : t1;
      if (winner) winner.wins++;
      if (loser) loser.losses++;
    }
  }
  for (const [groupId, t] of tally) {
    await tx.friendlyWarGroup.updateMany({
      where: { warId: war.id, groupId },
      data: { wins: t.wins, losses: t.losses, draws: t.draws, score: t.wins },
    });
  }

  const settled = real.length > 0 && real.every((m) => m.status === "COMPLETED");
  if (!settled || war.status !== "IN_PROGRESS" || tally.size !== 2) return false;

  const [a, b] = [...tally.entries()];
  const winnerGroupId = a[1].wins === b[1].wins ? null : a[1].wins > b[1].wins ? a[0] : b[0];
  const closed = await tx.friendlyWar.updateMany({
    where: { id: war.id, status: "IN_PROGRESS" },
    data: { status: "COMPLETED", completedAt: new Date(), winnerGroupId, isDraw: winnerGroupId === null },
  });
  if (closed.count === 0) return false;

  const selected = await tx.friendlyWarParticipant.findMany({
    where: { warId: war.id, status: "SELECTED", group: { isCore: true } },
    select: { userId: true },
  });
  if (selected.length) {
    await tx.user.updateMany({
      where: { id: { in: selected.map((e) => e.userId) } },
      data: { friendlyMatchCount: { increment: 1 } },
    });
  }
  await tx.tournament.update({
    where: { id: tournamentId },
    data: { active: false, completed: true, checkInOpen: false, currentStage: "COMPLETED" },
  });
  return true;
}
