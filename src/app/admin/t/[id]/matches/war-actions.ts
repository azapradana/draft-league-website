"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateWarPairings, syncWarOutcome } from "@/lib/friendly-war";
import { prisma } from "@/lib/prisma";

export type WarAdminResult = { success: true; message: string } | { error: string };

class WarAdminError extends Error {}

function refresh(tournamentId: string) {
  revalidatePath(`/admin/t/${tournamentId}/matches`);
  revalidatePath(`/t/${tournamentId}`);
  revalidatePath(`/t/${tournamentId}/war`);
}

async function run(
  tournamentId: string,
  work: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], war: WarContext) => Promise<string>,
): Promise<WarAdminResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return { error: "Admin access is required." };
  try {
    const message = await prisma.$transaction(async (tx) => {
      const war = await tx.friendlyWar.findUnique({
        where: { tournamentId },
        select: {
          id: true,
          status: true,
          squadSize: true,
          groups: { select: { groupId: true } },
        },
      });
      if (!war) throw new WarAdminError("No Friendly Match war exists for this tournament.");
      const core = await tx.group.findFirst({ where: { isCore: true }, select: { id: true } });
      const allowedGroupIds = new Set([...war.groups.map((g) => g.groupId), ...(core ? [core.id] : [])]);
      const text = await work(tx, { ...war, allowedGroupIds, coreGroupId: core?.id ?? null });
      await syncWarOutcome(tx, tournamentId);
      return text;
    });
    refresh(tournamentId);
    return { success: true, message };
  } catch (error) {
    if (error instanceof WarAdminError) return { error: error.message };
    console.error("war admin action failed", error);
    return { error: "Could not save the change." };
  }
}

type WarContext = {
  id: string;
  status: string;
  squadSize: number;
  allowedGroupIds: Set<string>;
  coreGroupId: string | null;
};
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function assertEditable(war: WarContext) {
  if (war.status === "COMPLETED" || war.status === "CANCELLED") {
    throw new WarAdminError("This war has concluded and its rosters are read-only.");
  }
}

async function ensureEntry(tx: Tx, war: WarContext, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { groupId: true } });
  if (!user) throw new WarAdminError("User not found.");
  if (!user.groupId || !war.allowedGroupIds.has(user.groupId)) {
    throw new WarAdminError("That user belongs to neither 7DS nor this war's rival group.");
  }
  // Admin force-assignment bypasses the opt-in window and the priority queue.
  return tx.friendlyWarParticipant.upsert({
    where: { warId_userId: { warId: war.id, userId } },
    update: { status: "SELECTED", forceAssigned: true, groupId: user.groupId },
    create: {
      warId: war.id,
      userId,
      groupId: user.groupId,
      status: "SELECTED",
      forceAssigned: true,
    },
  });
}

export async function startWarPairings(tournamentId: string): Promise<WarAdminResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return { error: "Admin access is required." };
  const war = await prisma.friendlyWar.findUnique({
    where: { tournamentId },
    select: { id: true },
  });
  if (!war) return { error: "No Friendly Match war exists for this tournament." };
  const result = await generateWarPairings(war.id);
  if (!result.ok) return { error: result.error };
  refresh(tournamentId);
  return {
    success: true,
    message: `Generated ${result.pairs} pairings${
      result.unpaired ? ` (${result.unpaired} players unpaired)` : ""
    }.`,
  };
}

// Adds a user to the war roster as an admin-forced SELECTED player.
export async function forceAssignToWar(tournamentId: string, userId: string) {
  return run(tournamentId, async (tx, war) => {
    assertEditable(war);
    await ensureEntry(tx, war, userId);
    return "User added to the active roster.";
  });
}

// Removes a user from the war; their pending pairing slot becomes empty.
export async function removeFromWar(tournamentId: string, userId: string) {
  return run(tournamentId, async (tx, war) => {
    assertEditable(war);
    const participant = await tx.participant.findUnique({
      where: { userId_tournamentId: { userId, tournamentId } },
      select: { id: true },
    });
    if (participant) {
      const matches = await tx.match.findMany({
        where: {
          tournamentId,
          OR: [{ player1Id: participant.id }, { player2Id: participant.id }],
        },
        select: { id: true, status: true, player1Id: true },
      });
      if (matches.some((m) => m.status === "COMPLETED")) {
        throw new WarAdminError("This player already has a completed match and cannot be removed.");
      }
      for (const match of matches) {
        await tx.match.update({
          where: { id: match.id },
          data: {
            [match.player1Id === participant.id ? "player1Id" : "player2Id"]: null,
            status: "PENDING",
            winnerId: null,
            player1Vote: null,
            player2Vote: null,
          },
        });
      }
    }
    await tx.friendlyWarParticipant.deleteMany({ where: { warId: war.id, userId } });
    return "User removed from the war.";
  });
}

// Puts a user into one slot of a pending pairing (adding them to the roster if needed).
export async function assignToMatch(
  tournamentId: string,
  matchId: string,
  slot: "player1" | "player2",
  userId: string,
) {
  return run(tournamentId, async (tx, war) => {
    assertEditable(war);
    if (war.status !== "IN_PROGRESS") {
      throw new WarAdminError("Pairings have not been generated yet.");
    }
    const match = await tx.match.findFirst({
      where: { id: matchId, tournamentId },
      select: { status: true, player1Id: true, player2Id: true },
    });
    if (!match) throw new WarAdminError("Match not found.");
    if (match.status === "COMPLETED") {
      throw new WarAdminError("Completed matches cannot be re-rostered.");
    }

    const entry = await ensureEntry(tx, war, userId);
    const participant = await tx.participant.upsert({
      where: { userId_tournamentId: { userId, tournamentId } },
      update: { status: "APPROVED", checkedIn: true },
      create: { userId, tournamentId, status: "APPROVED", checkedIn: true },
      select: { id: true },
    });

    const busy = await tx.match.findFirst({
      where: {
        tournamentId,
        id: { not: matchId },
        OR: [{ player1Id: participant.id }, { player2Id: participant.id }],
      },
      select: { id: true },
    });
    if (busy) {
      throw new WarAdminError("That user is already paired. Remove them from their match first.");
    }

    const otherId = slot === "player1" ? match.player2Id : match.player1Id;
    if (otherId === participant.id) {
      throw new WarAdminError("That user already holds the opposite slot.");
    }
    if (otherId) {
      const opponent = await tx.participant.findUnique({
        where: { id: otherId },
        select: { userId: true },
      });
      const opponentEntry = opponent
        ? await tx.friendlyWarParticipant.findUnique({
            where: { warId_userId: { warId: war.id, userId: opponent.userId } },
            select: { groupId: true },
          })
        : null;
      if (opponentEntry && opponentEntry.groupId === entry.groupId) {
        throw new WarAdminError("A pairing must put one player from each group against each other.");
      }
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        [slot === "player1" ? "player1Id" : "player2Id"]: participant.id,
        status: "PENDING",
        winnerId: null,
        player1Vote: null,
        player2Vote: null,
        player1Score: null,
        player2Score: null,
      },
    });
    return "Pairing updated.";
  });
}

export async function clearMatchSlot(
  tournamentId: string,
  matchId: string,
  slot: "player1" | "player2",
) {
  return run(tournamentId, async (tx, war) => {
    assertEditable(war);
    const match = await tx.match.findFirst({
      where: { id: matchId, tournamentId },
      select: { status: true },
    });
    if (!match) throw new WarAdminError("Match not found.");
    if (match.status === "COMPLETED") {
      throw new WarAdminError("Completed matches cannot be re-rostered.");
    }
    await tx.match.update({
      where: { id: matchId },
      data: {
        [slot === "player1" ? "player1Id" : "player2Id"]: null,
        status: "PENDING",
        winnerId: null,
        player1Vote: null,
        player2Vote: null,
      },
    });
    return "Slot cleared.";
  });
}

// Records a drawn individual match (no winner); it counts as a draw for both groups.
export async function declareWarMatchDraw(tournamentId: string, matchId: string) {
  return run(tournamentId, async (tx, war) => {
    assertEditable(war);
    const match = await tx.match.findFirst({
      where: { id: matchId, tournamentId },
      select: { player1Id: true, player2Id: true },
    });
    if (!match) throw new WarAdminError("Match not found.");
    if (!match.player1Id || !match.player2Id) {
      throw new WarAdminError("Only matches with two players can be drawn.");
    }
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: "COMPLETED",
        winnerId: null,
        adminOverrideById: (await getServerSession(authOptions))?.user?.id ?? null,
        adminOverrideAt: new Date(),
      },
    });
    return "Match recorded as a draw.";
  });
}
