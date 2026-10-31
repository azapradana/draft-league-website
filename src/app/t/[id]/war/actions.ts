"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { finalizeCoreSquad } from "@/lib/friendly-war";
import { prisma } from "@/lib/prisma";

export type WarActionResult = { success: true; message?: string } | { error: string };

function refresh(tournamentId: string) {
  revalidatePath(`/t/${tournamentId}/war`);
}

async function loadOpenWar(tournamentId: string) {
  return prisma.friendlyWar.findUnique({
    where: { tournamentId },
    select: { id: true, status: true },
  });
}

export async function joinWar(tournamentId: string): Promise<WarActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in to join the war." };

  const [war, user] = await Promise.all([
    loadOpenWar(tournamentId),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { groupId: true, group: { select: { isCore: true } } },
    }),
  ]);
  if (!war) return { error: "No Friendly Match war exists for this tournament." };
  if (war.status !== "OPEN") return { error: "The opt-in window is closed." };
  if (!user?.groupId || !user.group?.isCore) return { error: "Only 7DS members can join this war." };

  await prisma.friendlyWarParticipant.upsert({
    where: { warId_userId: { warId: war.id, userId: session.user.id } },
    update: {},
    create: { warId: war.id, userId: session.user.id, groupId: user.groupId },
  });
  refresh(tournamentId);
  return { success: true, message: "You joined the war." };
}

export async function leaveWar(tournamentId: string): Promise<WarActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in first." };
  const war = await loadOpenWar(tournamentId);
  if (!war) return { error: "No Friendly Match war exists for this tournament." };
  if (war.status !== "OPEN") return { error: "The opt-in window is closed." };

  const result = await prisma.friendlyWarParticipant.deleteMany({
    where: { warId: war.id, userId: session.user.id, forceAssigned: false },
  });
  if (result.count === 0) return { error: "You are not opted in, or an admin assigned you." };
  refresh(tournamentId);
  return { success: true, message: "You left the war." };
}

// Admin only: closes opt-in and runs the priority-queue selection.
export async function finalizeSquad(tournamentId: string): Promise<WarActionResult> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return { error: "Admin access is required." };
  const war = await loadOpenWar(tournamentId);
  if (!war) return { error: "No Friendly Match war exists for this tournament." };

  const result = await finalizeCoreSquad(war.id);
  if (!result.ok) return { error: result.error };
  refresh(tournamentId);
  return {
    success: true,
    message: `Roster finalized: ${result.selected} selected, ${result.bench} on the bench.`,
  };
}
